import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { loadProjectScope, requireProjectAccess } from '../../middleware/projectScope';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';

const listQuerySchema = z.object({ projectId: z.string().uuid() });

const createSchema = z.object({
  projectId: z.string().uuid(),
  date: calendarDateSchema,
  weather: z.string().max(80).optional(),
  workforce: z.coerce.number().int().nonnegative().optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(5000),
});

const updateSchema = z.object({
  date: calendarDateSchema.optional(),
  weather: z.string().max(80).optional().nullable(),
  workforce: z.coerce.number().int().nonnegative().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(5000).optional(),
});

const entryInclude = {
  creator: { select: { firstName: true, lastName: true, email: true } },
} as const;

export const bitacoraRouter = Router();
bitacoraRouter.use(authenticate);
bitacoraRouter.use(loadProjectScope);

bitacoraRouter.get(
  '/',
  requirePermission(PERMISSIONS.BITACORA_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const entries = await prisma.bitacoraEntry.findMany({
      where: { projectId: req.query.projectId as string, deletedAt: null },
      include: entryInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return success(res, entries);
  }),
);

bitacoraRouter.post(
  '/',
  requirePermission(PERMISSIONS.BITACORA_WRITE),
  validate(createSchema),
  requireProjectAccess((req) => req.body.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.bitacoraEntry.create({
      data: {
        projectId: req.body.projectId,
        date: req.body.date,
        weather: req.body.weather || null,
        workforce: req.body.workforce ?? null,
        title: req.body.title || null,
        content: req.body.content,
        createdBy: req.user.id,
      },
      include: entryInclude,
    });
    return success(res, created, 201);
  }),
);

bitacoraRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.BITACORA_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const entry = await prisma.bitacoraEntry.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!entry) throw new NotFoundError('Entrada de bitácora no encontrada');
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(entry.projectId)) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }
    const updated = await prisma.bitacoraEntry.update({
      where: { id: entry.id },
      data: req.body,
      include: entryInclude,
    });
    return success(res, updated);
  }),
);

bitacoraRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BITACORA_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const entry = await prisma.bitacoraEntry.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!entry) throw new NotFoundError('Entrada de bitácora no encontrada');
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(entry.projectId)) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }
    await prisma.bitacoraEntry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Entrada eliminada' });
  }),
);
