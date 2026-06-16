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
  // Imagen opcional (base64 sin prefijo). null para quitarla en edición.
  imageBase64: z.string().min(10).nullable().optional(),
  imageMime: z.string().regex(/^image\//).nullable().optional(),
});

const updateSchema = createSchema.partial();

// Campos que devolvemos en listas/detalle (sin los bytes de la imagen).
const productSelect = {
  id: true,
  name: true,
  unit: true,
  description: true,
  unitPrice: true,
  imageMime: true,
  createdAt: true,
} as const;

function toView(p: {
  id: string;
  name: string;
  unit: string;
  description: string;
  unitPrice: number;
  imageMime: string | null;
  createdAt: Date;
}) {
  return { ...p, hasImage: !!p.imageMime };
}

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: productSelect,
    });
    return success(res, products.map(toView));
  }),
);

// Sirve el binario de la imagen del producto (protegido por token).
productsRouter.get(
  '/:id/image',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { imageData: true, imageMime: true },
    });
    if (!product || !product.imageData || !product.imageMime) {
      throw new NotFoundError('Imagen no encontrada');
    }
    res.setHeader('Content-Type', product.imageMime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(product.imageData));
  }),
);

productsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const hasImg = !!req.body.imageBase64;
    const created = await prisma.product.create({
      data: {
        name: req.body.name,
        unit: req.body.unit || 'U',
        description: req.body.description,
        unitPrice: req.body.unitPrice ?? 0,
        imageData: hasImg ? Buffer.from(req.body.imageBase64, 'base64') : null,
        imageMime: hasImg ? req.body.imageMime ?? 'image/png' : null,
        createdBy: req.user.id,
      },
      select: productSelect,
    });
    return success(res, toView(created), 201);
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

    const { imageBase64, imageMime, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    // imageBase64: string → nueva imagen; null → quitar; undefined → no tocar.
    if (imageBase64 === null) {
      data.imageData = null;
      data.imageMime = null;
    } else if (typeof imageBase64 === 'string') {
      data.imageData = Buffer.from(imageBase64, 'base64');
      data.imageMime = imageMime ?? 'image/png';
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      select: productSelect,
    });
    return success(res, toView(updated));
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
