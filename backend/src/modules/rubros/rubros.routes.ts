import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError } from '../../utils/errors';
import { ERRORS, SUCCESS } from '../../shared/constants/error-messages';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const createRubroSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  unit: z.string().max(20).optional(),
  quantity: z.coerce.number().nonnegative().default(0),
  unitPrice: z.coerce.number().nonnegative().default(0),
  budgetedAmount: z.coerce.number().nonnegative(),
  orderIndex: z.coerce.number().int().nonnegative().default(0),
  parentId: z.string().uuid().optional(),
  isGroup: z.coerce.boolean().default(false),
});

const updateRubroSchema = createRubroSchema.partial().omit({ projectId: true });
const listRubrosQuerySchema = z.object({ projectId: z.string().uuid() });

export const rubrosRouter = Router();
rubrosRouter.use(authenticate);

rubrosRouter.get(
  '/',
  requirePermission(PERMISSIONS.RUBROS_READ),
  validate(listRubrosQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const items = await prisma.rubro.findMany({
      where: { projectId: req.query.projectId as string, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });
    return success(res, items);
  }),
);

rubrosRouter.post(
  '/',
  requirePermission(PERMISSIONS.RUBROS_WRITE),
  validate(createRubroSchema),
  asyncHandler(async (req, res) => {
    const created = await prisma.rubro.create({ data: req.body });
    return success(res, created, 201);
  }),
);

rubrosRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.RUBROS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateRubroSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.rubro.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError(ERRORS.RUBRO_NOT_FOUND);
    const updated = await prisma.rubro.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return success(res, updated);
  }),
);

rubrosRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.RUBROS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.rubro.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: SUCCESS.RUBRO_DELETED });
  }),
);
