import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const createSchema = z.object({
  projectId: z.string().uuid(),
  rubroId: z.string().uuid(),
  description: z.string().min(1).max(300),
  invoiceNumber: z.string().max(80).optional(),
  amount: z.coerce.number().positive(),
  scheduledDate: z.coerce.date(),
});

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
});

export const paymentOrdersRouter = Router();
paymentOrdersRouter.use(authenticate);

paymentOrdersRouter.get(
  '/',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_READ),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const items = await prisma.paymentOrder.findMany({
      where: {
        deletedAt: null,
        ...(req.query.projectId ? { projectId: req.query.projectId as string } : {}),
        ...(req.query.status ? { status: req.query.status as string } : {}),
      },
      include: { rubro: { select: { code: true, name: true } } },
      orderBy: { scheduledDate: 'asc' },
    });
    return success(res, items);
  }),
);

paymentOrdersRouter.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    const rubro = await prisma.rubro.findFirst({
      where: { id: req.body.rubroId, projectId: req.body.projectId, deletedAt: null },
    });
    if (!rubro) throw new NotFoundError('El rubro no pertenece al proyecto');

    const created = await prisma.paymentOrder.create({
      data: { ...req.body, createdBy: req.user.id },
      include: { rubro: { select: { code: true, name: true } } },
    });
    return success(res, created, 201);
  }),
);

// Marcar como pagada → crea automáticamente el gasto correspondiente
paymentOrdersRouter.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestError(`La orden ya está en estado ${order.status}`);
    }

    const userId = req.user.id;
    const paidAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: {
          projectId: order.projectId,
          rubroId: order.rubroId,
          description: order.description,
          invoiceNumber: order.invoiceNumber,
          amount: order.amount,
          gastoDate: paidAt,
          createdBy: userId,
        },
      });

      const updated = await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt, gastoId: gasto.id },
        include: { rubro: { select: { code: true, name: true } } },
      });

      return updated;
    });

    return success(res, result);
  }),
);

paymentOrdersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');

    // Si ya fue pagada, también soft-delete del gasto asociado
    await prisma.$transaction(async (tx) => {
      if (order.gastoId) {
        await tx.gasto.update({
          where: { id: order.gastoId },
          data: { deletedAt: new Date() },
        });
      }
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { deletedAt: new Date() },
      });
    });

    return success(res, { message: 'Orden de pago eliminada' });
  }),
);
