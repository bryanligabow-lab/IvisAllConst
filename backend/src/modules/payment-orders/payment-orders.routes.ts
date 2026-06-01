import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import {
  loadProjectScope,
  requireProjectAccess,
  projectScopeWhere,
} from '../../middleware/projectScope';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError, ForbiddenError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';

export const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'CHECK',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'OTHER',
] as const;

// Desglose de una factura por rubro (parrotear el monto entre varios rubros).
const orderItemSchema = z.object({
  rubroId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

const createSchema = z
  .object({
    projectId: z.string().uuid(),
    providerId: z.string().uuid({ message: 'El proveedor es obligatorio' }),
    description: z.string().min(1).max(300),
    invoiceNumber: z.string().max(80).optional(),
    // El método de pago ya NO es obligatorio al crear: lo fija quien aprueba/paga.
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    scheduledDate: calendarDateSchema,
    // Una orden puede tener un solo rubro (rubroId + amount) o desglosarse en
    // varios rubros (items[]). Al menos una de las dos formas es obligatoria.
    rubroId: z.string().uuid().optional(),
    amount: z.coerce.number().positive().optional(),
    items: z.array(orderItemSchema).min(1).optional(),
  })
  .refine((d) => (d.items && d.items.length > 0) || (d.rubroId && d.amount), {
    message: 'Indica un rubro con su monto o un desglose por rubros',
  });

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
});

const paySchema = z.object({
  mode: z.enum(['TOTAL', 'PARTIAL']).default('TOTAL'),
  amount: z.coerce.number().positive().optional(),
  reference: z.string().max(200).optional(),
  // Método de pago elegido al momento de pagar.
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

const orderInclude = {
  rubro: { select: { code: true, name: true } },
  provider: { select: { id: true, name: true, ruc: true, service: true } },
  items: {
    select: {
      id: true,
      amount: true,
      rubro: { select: { id: true, code: true, name: true } },
    },
  },
  gastos: {
    where: { deletedAt: null },
    select: { id: true, amount: true, gastoDate: true, description: true },
    orderBy: { gastoDate: 'asc' as const },
  },
} as const;

// Add computed paidAmount + pendingAmount fields to each order in the response.
function decorateOrder<T extends { amount: number; gastos: { amount: number }[] }>(o: T) {
  const paidAmount = o.gastos.reduce((s, g) => s + g.amount, 0);
  const pendingAmount = Math.max(0, o.amount - paidAmount);
  return { ...o, paidAmount, pendingAmount };
}

export const paymentOrdersRouter = Router();
paymentOrdersRouter.use(authenticate);
paymentOrdersRouter.use(loadProjectScope);

paymentOrdersRouter.get(
  '/',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const items = await prisma.paymentOrder.findMany({
      where: {
        deletedAt: null,
        ...projectScopeWhere(req),
        ...(req.query.projectId ? { projectId: req.query.projectId as string } : {}),
        ...(req.query.status ? { status: req.query.status as string } : {}),
      },
      include: orderInclude,
      orderBy: { scheduledDate: 'asc' },
    });
    return success(res, items.map(decorateOrder));
  }),
);

paymentOrdersRouter.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_WRITE),
  validate(createSchema),
  requireProjectAccess((req) => req.body.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    // Normalizar a una lista de líneas (rubro + monto).
    const lines: Array<{ rubroId: string; amount: number }> =
      req.body.items && req.body.items.length > 0
        ? req.body.items
        : [{ rubroId: req.body.rubroId, amount: req.body.amount }];

    const totalAmount = lines.reduce((s, l) => s + Number(l.amount), 0);
    if (totalAmount <= 0) throw new BadRequestError('El monto total debe ser mayor a 0');

    // Validar que todos los rubros pertenezcan al proyecto.
    const rubroIds = Array.from(new Set(lines.map((l) => l.rubroId)));
    const rubros = await prisma.rubro.findMany({
      where: { id: { in: rubroIds }, projectId: req.body.projectId, deletedAt: null },
      select: { id: true },
    });
    if (rubros.length !== rubroIds.length) {
      throw new NotFoundError('Algún rubro no pertenece al proyecto');
    }

    const provider = await prisma.provider.findFirst({
      where: { id: req.body.providerId, deletedAt: null },
    });
    if (!provider) throw new NotFoundError('Proveedor no encontrado');

    const created = await prisma.paymentOrder.create({
      data: {
        projectId: req.body.projectId,
        // Rubro principal solo si es una orden de un único rubro.
        rubroId: lines.length === 1 ? lines[0].rubroId : null,
        providerId: req.body.providerId,
        description: req.body.description,
        invoiceNumber: req.body.invoiceNumber,
        paymentMethod: req.body.paymentMethod ?? null,
        amount: totalAmount,
        scheduledDate: req.body.scheduledDate,
        createdBy: req.user.id,
        items: {
          create: lines.map((l) => ({ rubroId: l.rubroId, amount: Number(l.amount) })),
        },
      },
      include: orderInclude,
    });
    return success(res, decorateOrder(created), 201);
  }),
);

// Marcar como pagada (total o parcial) → crea gasto(s), divididos por rubro.
paymentOrdersRouter.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_APPROVE),
  validate(idParamSchema, 'params'),
  validate(paySchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const userId = req.user.id;

    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        items: { select: { rubroId: true, amount: true } },
        gastos: { where: { deletedAt: null }, select: { amount: true } },
      },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(order.projectId)) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }
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

    // Reparte el monto pagado entre los rubros de la orden (proporcional al
    // desglose). Si la orden no tiene items (orden antigua de un solo rubro),
    // usa el rubro principal.
    const lines: Array<{ rubroId: string; amount: number }> =
      order.items.length > 0
        ? order.items.map((it) => ({ rubroId: it.rubroId, amount: it.amount }))
        : order.rubroId
          ? [{ rubroId: order.rubroId, amount: order.amount }]
          : [];
    if (lines.length === 0) {
      throw new BadRequestError('La orden no tiene rubro asociado');
    }

    // Montos por rubro para ESTE pago, ajustando el redondeo en la última línea.
    const shares = lines.map((l) => ({
      rubroId: l.rubroId,
      amount: Math.round(amountToPay * (l.amount / order.amount) * 100) / 100,
    }));
    const assigned = shares.reduce((s, sh) => s + sh.amount, 0);
    const drift = Math.round((amountToPay - assigned) * 100) / 100;
    if (drift !== 0 && shares.length > 0) shares[shares.length - 1].amount += drift;

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      for (const sh of shares) {
        if (sh.amount <= 0) continue;
        await tx.gasto.create({
          data: {
            projectId: order.projectId,
            rubroId: sh.rubroId,
            providerId: order.providerId,
            paymentOrderId: order.id,
            description: lines.length > 1 ? `${baseDesc} (rubro)` : baseDesc,
            invoiceNumber: order.invoiceNumber,
            amount: sh.amount,
            gastoDate: now,
            createdBy: userId,
          },
        });
      }

      const newPaid = paidSoFar + amountToPay;
      const isFullyPaid = newPaid >= order.amount - 0.0001;

      const updated = await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          ...(req.body.paymentMethod ? { paymentMethod: req.body.paymentMethod } : {}),
          ...(isFullyPaid ? { status: 'PAID', paidAt: now } : {}),
        },
        include: orderInclude,
      });

      return updated;
    });

    return success(res, decorateOrder(result));
  }),
);

paymentOrdersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENT_ORDERS_APPROVE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { gastos: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!order) throw new NotFoundError('Orden de pago no encontrada');
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(order.projectId)) {
      throw new ForbiddenError('No tienes acceso a este proyecto');
    }

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
