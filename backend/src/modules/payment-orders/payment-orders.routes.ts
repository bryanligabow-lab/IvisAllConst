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

export const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'CHECK',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'OTHER',
] as const;

const createSchema = z.object({
  projectId: z.string().uuid(),
  rubroId: z.string().uuid(),
  providerId: z.string().uuid({ message: 'El proveedor es obligatorio' }),
  description: z.string().min(1).max(300),
  invoiceNumber: z.string().max(80).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'El método de pago es obligatorio' }),
  }),
  amount: z.coerce.number().positive(),
  scheduledDate: z.coerce.date(),
});

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
});

const paySchema = z.object({
  mode: z.enum(['TOTAL', 'PARTIAL']).default('TOTAL'),
  amount: z.coerce.number().positive().optional(),
  reference: z.string().max(200).optional(),
});

// Add computed paidAmount + pendingAmount fields to each order in the response.
function decorateOrder<T extends { amount: number; gastos: { amount: number }[] }>(o: T) {
  const paidAmount = o.gastos.reduce((s, g) => s + g.amount, 0);
  const pendingAmount = Math.max(0, o.amount - paidAmount);
  return { ...o, paidAmount, pendingAmount };
}

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
      include: {
        rubro: { select: { code: true, name: true } },
        provider: { select: { id: true, name: true, ruc: true, service: true } },
        gastos: {
          where: { deletedAt: null },
          select: { id: true, amount: true, gastoDate: true, description: true },
          orderBy: { gastoDate: 'asc' },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });
    return success(res, items.map(decorateOrder));
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

    // Validar que el proveedor exista y no esté borrado
    const provider = await prisma.provider.findFirst({
      where: { id: req.body.providerId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError('Proveedor no encontrado');

    const created = await prisma.paymentOrder.create({
      data: {
        projectId: req.body.projectId,
        rubroId: req.body.rubroId,
        providerId: req.body.providerId,
        description: req.body.description,
        invoiceNumber: req.body.invoiceNumber,
        paymentMethod: req.body.paymentMethod,
        amount: req.body.amount,
        scheduledDate: req.body.scheduledDate,
        createdBy: req.user.id,
      },
      include: {
        rubro: { select: { code: true, name: true } },
        provider: { select: { id: true, name: true, ruc: true, service: true } },
        gastos: { select: { id: true, amount: true, gastoDate: true, description: true } },
      },
    });
    return success(res, decorateOrder(created), 201);
  }),
);

// Marcar como pagada (total o parcial) → crea gasto(s)
paymentOrdersRouter.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  validate(idParamSchema, 'params'),
  validate(paySchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const userId = req.user.id;

    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { gastos: { where: { deletedAt: null }, select: { amount: true } } },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');
    if (order.status !== 'PENDING') {
      throw new BadRequestError(`La orden ya está en estado ${order.status}`);
    }

    const paidSoFar = order.gastos.reduce((s, g) => s + g.amount, 0);
    const remaining = order.amount - paidSoFar;
    if (remaining <= 0) {
      throw new BadRequestError('La orden ya está totalmente pagada');
    }

    const mode = req.body.mode as 'TOTAL' | 'PARTIAL';
    let amountToPay = remaining;
    if (mode === 'PARTIAL') {
      const requested = Number(req.body.amount);
      if (!requested || requested <= 0) {
        throw new BadRequestError('Debes indicar el monto del pago parcial');
      }
      if (requested > remaining + 0.0001) {
        throw new BadRequestError(
          `El pago parcial ($${requested.toFixed(2)}) no puede ser mayor al saldo pendiente ($${remaining.toFixed(2)})`,
        );
      }
      amountToPay = requested;
    }

    const refTag = req.body.reference ? ` — ${req.body.reference}` : '';
    const baseDesc =
      mode === 'PARTIAL' && amountToPay < remaining
        ? `${order.description} — Pago parcial$${refTag}`
        : `${order.description}${refTag}`;

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.gasto.create({
        data: {
          projectId: order.projectId,
          rubroId: order.rubroId,
          providerId: order.providerId,
          paymentOrderId: order.id,
          description: baseDesc,
          invoiceNumber: order.invoiceNumber,
          amount: amountToPay,
          gastoDate: now,
          createdBy: userId,
        },
      });

      const newPaid = paidSoFar + amountToPay;
      const isFullyPaid = newPaid >= order.amount - 0.0001;

      const updated = await tx.paymentOrder.update({
        where: { id: order.id },
        data: isFullyPaid
          ? { status: 'PAID', paidAt: now }
          : {},
        include: {
          rubro: { select: { code: true, name: true } },
          provider: { select: { id: true, name: true, ruc: true, service: true } },
          gastos: {
            where: { deletedAt: null },
            select: { id: true, amount: true, gastoDate: true, description: true },
            orderBy: { gastoDate: 'asc' },
          },
        },
      });

      return updated;
    });

    return success(res, decorateOrder(result));
  }),
);

paymentOrdersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { gastos: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');

    // Soft-delete: también borra los gastos creados por esta orden (parciales + total)
    await prisma.$transaction(async (tx) => {
      if (order.gastos.length) {
        await tx.gasto.updateMany({
          where: { id: { in: order.gastos.map((g) => g.id) } },
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
