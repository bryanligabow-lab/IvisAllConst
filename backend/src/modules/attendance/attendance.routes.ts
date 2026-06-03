import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { loadProjectScope, requireProjectAccess } from '../../middleware/projectScope';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { calendarDateSchema } from '../../shared/utils/date.util';

export const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'PERMISSION', 'REST'] as const;

const listQuerySchema = z.object({
  projectId: z.string().uuid(),
  date: calendarDateSchema,
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')
  .optional()
  .or(z.literal(''));

const bulkSchema = z.object({
  projectId: z.string().uuid(),
  date: calendarDateSchema,
  records: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        status: z.enum(ATTENDANCE_STATUS),
        checkIn: timeSchema,
        checkOut: timeSchema,
        notes: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

const historyQuerySchema = z.object({
  projectId: z.string().uuid(),
  from: calendarDateSchema.optional(),
  to: calendarDateSchema.optional(),
});

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);
attendanceRouter.use(loadProjectScope);

// Empleados del proyecto + su asistencia para una fecha dada.
attendanceRouter.get(
  '/',
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string;
    const date = req.query.date as unknown as Date;

    const employees = await prisma.employee.findMany({
      where: { projectId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, fullName: true, position: true, cedula: true },
      orderBy: { fullName: 'asc' },
    });

    const records = await prisma.attendance.findMany({
      where: { projectId, date },
    });
    const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

    const rows = employees.map((e) => {
      const rec = byEmployee.get(e.id);
      return {
        employeeId: e.id,
        fullName: e.fullName,
        position: e.position,
        cedula: e.cedula,
        status: rec?.status ?? null,
        checkIn: rec?.checkIn ?? null,
        checkOut: rec?.checkOut ?? null,
        notes: rec?.notes ?? null,
      };
    });

    return success(res, rows);
  }),
);

// Guarda (upsert) la asistencia de varios empleados para una fecha.
attendanceRouter.post(
  '/bulk',
  requirePermission(PERMISSIONS.ATTENDANCE_WRITE),
  validate(bulkSchema),
  requireProjectAccess((req) => req.body.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const userId = req.user.id;
    const { projectId, date, records } = req.body as {
      projectId: string;
      date: Date;
      records: Array<{
        employeeId: string;
        status: string;
        checkIn?: string;
        checkOut?: string;
        notes?: string;
      }>;
    };

    // Solo empleados que pertenezcan al proyecto (evita inyectar ajenos).
    const valid = await prisma.employee.findMany({
      where: { id: { in: records.map((r) => r.employeeId) }, projectId, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(valid.map((e) => e.id));

    await prisma.$transaction(
      records
        .filter((r) => validIds.has(r.employeeId))
        .map((r) =>
          prisma.attendance.upsert({
            where: { employeeId_date: { employeeId: r.employeeId, date } },
            update: {
              status: r.status,
              checkIn: r.checkIn || null,
              checkOut: r.checkOut || null,
              notes: r.notes ?? null,
            },
            create: {
              employeeId: r.employeeId,
              projectId,
              date,
              status: r.status,
              checkIn: r.checkIn || null,
              checkOut: r.checkOut || null,
              notes: r.notes ?? null,
              createdBy: userId,
            },
          }),
        ),
    );

    return success(res, { saved: validIds.size });
  }),
);

// Historial de asistencia del proyecto (resumen por día).
attendanceRouter.get(
  '/history',
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(historyQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string;
    const from = req.query.from as unknown as Date | undefined;
    const to = req.query.to as unknown as Date | undefined;

    const records = await prisma.attendance.findMany({
      where: {
        projectId,
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ date: 'desc' }, { employee: { fullName: 'asc' } }],
    });

    return success(res, records);
  }),
);
