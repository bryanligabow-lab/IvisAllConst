import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, buildPaginationMeta } from '../../utils/apiResponse';
import { getPagination } from '../../utils/pagination';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { ERRORS, SUCCESS } from '../../shared/constants/error-messages';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const createGastoSchema = z.object({
  projectId: z.string().uuid(),
  rubroId: z.string().uuid(),
  description: z.string().min(1).max(300),
  invoiceNumber: z.string().max(80).optional(),
  amount: z.coerce.number().positive(),
  gastoDate: z.coerce.date(),
  attachmentUrl: z.string().url().max(2000).optional(),
});

const updateGastoSchema = createGastoSchema.partial().omit({ projectId: true });

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  rubroId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
});

export const gastosRouter = Router();
gastosRouter.use(authenticate);

gastosRouter.get(
  '/',
  requirePermission(PERMISSIONS.GASTOS_READ),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, perPage, skip, take } = getPagination(req);
    const where = {
      deletedAt: null,
      ...(req.query.projectId ? { projectId: req.query.projectId as string } : {}),
      ...(req.query.rubroId ? { rubroId: req.query.rubroId as string } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.gasto.findMany({
        where,
        skip,
        take,
        orderBy: { gastoDate: 'desc' },
        include: { rubro: { select: { code: true, name: true } } },
      }),
      prisma.gasto.count({ where }),
    ]);

    return success(res, items, 200, buildPaginationMeta(total, page, perPage));
  }),
);

gastosRouter.post(
  '/',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  validate(createGastoSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    const rubro = await prisma.rubro.findFirst({
      where: { id: req.body.rubroId, projectId: req.body.projectId, deletedAt: null },
    });
    if (!rubro) throw new NotFoundError(ERRORS.RUBRO_NOT_IN_PROJECT);

    const created = await prisma.gasto.create({
      data: { ...req.body, createdBy: req.user.id },
    });
    return success(res, created, 201);
  }),
);

gastosRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateGastoSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.gasto.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError(ERRORS.GASTO_NOT_FOUND);
    const updated = await prisma.gasto.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return success(res, updated);
  }),
);

gastosRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.gasto.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: SUCCESS.GASTO_DELETED });
  }),
);
