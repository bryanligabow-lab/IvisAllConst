import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const createSchema = z.object({
  name: z.string().min(1).max(300),
  ruc: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  responsible: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = createSchema.partial();

export const clientsRouter = Router();
clientsRouter.use(authenticate);

clientsRouter.get(
  '/',
  requirePermission(PERMISSIONS.CLIENTS_READ),
  asyncHandler(async (_req, res) => {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const ids = clients.map((c) => c.id);
    let countMap = new Map<string, number>();
    let totalMap = new Map<string, number>();
    if (ids.length > 0) {
      const proformas = await prisma.proforma.findMany({
        where: { clientId: { in: ids }, deletedAt: null },
        include: { items: true },
      });
      for (const p of proformas) {
        const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
        const total = subtotal * (1 + p.ivaPercent / 100);
        if (p.clientId) {
          countMap.set(p.clientId, (countMap.get(p.clientId) ?? 0) + 1);
          totalMap.set(p.clientId, (totalMap.get(p.clientId) ?? 0) + total);
        }
      }
    }

    return success(
      res,
      clients.map((c) => ({
        ...c,
        proformasCount: countMap.get(c.id) ?? 0,
        proformasTotal: totalMap.get(c.id) ?? 0,
      })),
    );
  }),
);

clientsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.CLIENTS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!client) throw new NotFoundError('Cliente no encontrado');

    const proformas = await prisma.proforma.findMany({
      where: { clientId: client.id, deletedAt: null },
      include: { items: true },
      orderBy: { date: 'desc' },
    });

    const withTotals = proformas.map((p) => {
      const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const iva = subtotal * (p.ivaPercent / 100);
      return { ...p, subtotal, iva, total: subtotal + iva };
    });

    return success(res, { client, proformas: withTotals });
  }),
);

clientsRouter.post(
  '/',
  requirePermission(PERMISSIONS.CLIENTS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.client.create({
      data: {
        name: req.body.name,
        ruc: req.body.ruc || null,
        address: req.body.address || null,
        responsible: req.body.responsible || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null,
        createdBy: req.user.id,
      },
    });
    return success(res, created, 201);
  }),
);

clientsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CLIENTS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.client.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Cliente no encontrado');
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return success(res, updated);
  }),
);

clientsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.CLIENTS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.client.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Cliente eliminado' });
  }),
);
