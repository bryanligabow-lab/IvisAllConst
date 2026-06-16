import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

// Catálogo de productos reutilizables para proformas.
const createSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(40).default('U'),
  description: z.string().min(1).max(500),
  unitPrice: z.coerce.number().nonnegative().default(0),
});

const updateSchema = createSchema.partial();

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return success(res, products);
  }),
);

productsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.product.create({
      data: {
        name: req.body.name,
        unit: req.body.unit || 'U',
        description: req.body.description,
        unitPrice: req.body.unitPrice ?? 0,
        createdBy: req.user.id,
      },
    });
    return success(res, created, 201);
  }),
);

productsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Producto no encontrado');
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return success(res, updated);
  }),
);

productsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Producto eliminado' });
  }),
);
