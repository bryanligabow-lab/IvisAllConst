import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const createSchema = z.object({
  fullName: z.string().min(1).max(200),
  cedula: z.string().max(40).optional().nullable(),
  position: z.string().max(200).optional().nullable(),
  monthlySalary: z.coerce.number().nonnegative().default(0),
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(40).optional().nullable(),
  hireDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const updateSchema = createSchema.partial();

const payrollSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid(),
  rubroId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  period: z.string().min(1).max(40),
  paymentMethod: z.enum([
    'CASH',
    'TRANSFER',
    'CHECK',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'OTHER',
  ]),
  description: z.string().max(300).optional(),
  paidAt: z.coerce.date().optional(),
});

export const employeesRouter = Router();
employeesRouter.use(authenticate);

// Historial completo de pagos de nómina (todos los empleados o filtrado por proyecto)
employeesRouter.get(
  '/payroll-history',
  requirePermission(PERMISSIONS.PAYROLL_READ),
  asyncHandler(async (req, res) => {
    const projectId =
      typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const employeeId =
      typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;

    const payments = await prisma.gasto.findMany({
      where: {
        deletedAt: null,
        kind: 'PAYROLL',
        ...(projectId ? { projectId } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, fullName: true, position: true, cedula: true } },
        project: { select: { id: true, name: true, code: true } },
        rubro: { select: { code: true, name: true } },
      },
      orderBy: { gastoDate: 'desc' },
    });

    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const byEmployee = new Map<string, number>();
    for (const p of payments) {
      if (p.employeeId) {
        byEmployee.set(p.employeeId, (byEmployee.get(p.employeeId) ?? 0) + Number(p.amount));
      }
    }

    return success(res, {
      payments,
      total,
      employeesPaid: byEmployee.size,
      avgPerEmployee: byEmployee.size > 0 ? total / byEmployee.size : 0,
    });
  }),
);


employeesRouter.get(
  '/',
  requirePermission(PERMISSIONS.EMPLOYEES_READ),
  asyncHandler(async (req, res) => {
    const projectId =
      typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    // For each employee compute totalPaid (sum of payroll gastos)
    const ids = employees.map((e) => e.id);
    let paidByEmployee = new Map<string, number>();
    if (ids.length > 0) {
      const agg = await prisma.gasto.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: ids }, deletedAt: null, kind: 'PAYROLL' },
        _sum: { amount: true },
      });
      paidByEmployee = new Map(agg.map((a) => [a.employeeId as string, Number(a._sum.amount ?? 0)]));
    }

    return success(
      res,
      employees.map((e) => ({ ...e, totalPaid: paidByEmployee.get(e.id) ?? 0 })),
    );
  }),
);

employeesRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEES_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { project: { select: { id: true, name: true, code: true } } },
    });
    if (!employee) throw new NotFoundError('Empleado no encontrado');

    const payments = await prisma.gasto.findMany({
      where: { employeeId: employee.id, deletedAt: null, kind: 'PAYROLL' },
      include: {
        project: { select: { id: true, name: true, code: true } },
        rubro: { select: { code: true, name: true } },
      },
      orderBy: { gastoDate: 'desc' },
    });

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

    return success(res, { employee, payments, totalPaid });
  }),
);

employeesRouter.post(
  '/',
  requirePermission(PERMISSIONS.EMPLOYEES_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.employee.create({
      data: {
        fullName: req.body.fullName,
        cedula: req.body.cedula || null,
        position: req.body.position || null,
        monthlySalary: req.body.monthlySalary ?? 0,
        email: req.body.email || null,
        phone: req.body.phone || null,
        hireDate: req.body.hireDate || null,
        endDate: req.body.endDate || null,
        projectId: req.body.projectId || null,
        status: req.body.status ?? 'ACTIVE',
        createdBy: req.user.id,
      },
    });
    return success(res, created, 201);
  }),
);

employeesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEES_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Empleado no encontrado');
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return success(res, updated);
  }),
);

employeesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEES_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Empleado eliminado' });
  }),
);

// Registrar un pago de nómina → crea un Gasto kind=PAYROLL
employeesRouter.post(
  '/payroll-payment',
  requirePermission(PERMISSIONS.PAYROLL_WRITE),
  validate(payrollSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const employee = await prisma.employee.findFirst({
      where: { id: req.body.employeeId, deletedAt: null },
    });
    if (!employee) throw new NotFoundError('Empleado no encontrado');

    const rubro = await prisma.rubro.findFirst({
      where: { id: req.body.rubroId, projectId: req.body.projectId, deletedAt: null },
    });
    if (!rubro) throw new BadRequestError('El rubro no pertenece al proyecto');

    const gasto = await prisma.gasto.create({
      data: {
        projectId: req.body.projectId,
        rubroId: req.body.rubroId,
        employeeId: employee.id,
        description: req.body.description || `Nómina ${req.body.period} — ${employee.fullName}`,
        amount: req.body.amount,
        gastoDate: req.body.paidAt ?? new Date(),
        kind: 'PAYROLL',
        paymentMethod: req.body.paymentMethod,
        createdBy: req.user.id,
      },
    });

    return success(res, gasto, 201);
  }),
);
