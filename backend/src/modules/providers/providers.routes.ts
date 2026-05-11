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
  name: z.string().min(1).max(200),
  ruc: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  service: z.string().max(300).optional(),
});

const updateSchema = createSchema.partial();

export const providersRouter = Router();
providersRouter.use(authenticate);

// --- Helper: compute per-provider stats globally or scoped to a project ---
async function computeProviderStats(projectId?: string) {
  const providers = await prisma.provider.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  const projectFilter = projectId ? { projectId } : {};

  // For each provider, aggregate gastos (totalSpent) + pending payment orders (totalDebt).
  const stats = await Promise.all(
    providers.map(async (p) => {
      const [spentAgg, ordersAll] = await Promise.all([
        prisma.gasto.aggregate({
          _sum: { amount: true },
          where: { providerId: p.id, deletedAt: null, ...projectFilter },
        }),
        prisma.paymentOrder.findMany({
          where: {
            providerId: p.id,
            deletedAt: null,
            status: { in: ['PENDING', 'PAID'] },
            ...projectFilter,
          },
          include: { gastos: { where: { deletedAt: null }, select: { amount: true } } },
        }),
      ]);

      let totalDebt = 0;
      let pendingOrdersCount = 0;
      let projectsWithDebt = new Set<string>();

      for (const o of ordersAll) {
        const paid = o.gastos.reduce((s, g) => s + g.amount, 0);
        const remaining = Math.max(0, o.amount - paid);
        if (remaining > 0 && o.status === 'PENDING') {
          totalDebt += remaining;
          pendingOrdersCount++;
          projectsWithDebt.add(o.projectId);
        }
      }

      return {
        ...p,
        totalSpent: spentAgg._sum.amount ?? 0,
        totalDebt,
        pendingOrdersCount,
        projectsWithDebtCount: projectsWithDebt.size,
      };
    }),
  );

  return stats;
}

providersRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROVIDERS_READ),
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const stats = await computeProviderStats(projectId);

    // When scoped to project, filter out providers with no activity in that project.
    if (projectId) {
      const filtered = stats.filter(
        (s) => Number(s.totalSpent) > 0 || s.pendingOrdersCount > 0,
      );
      return success(res, filtered);
    }
    return success(res, stats);
  }),
);

providersRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PROVIDERS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const provider = await prisma.provider.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!provider) throw new NotFoundError('Proveedor no encontrado');

    const [gastos, orders] = await Promise.all([
      prisma.gasto.findMany({
        where: { providerId: provider.id, deletedAt: null },
        include: {
          project: { select: { id: true, name: true, code: true } },
          rubro: { select: { code: true, name: true } },
        },
        orderBy: { gastoDate: 'desc' },
      }),
      prisma.paymentOrder.findMany({
        where: { providerId: provider.id, deletedAt: null },
        include: {
          project: { select: { id: true, name: true, code: true } },
          rubro: { select: { code: true, name: true } },
          gastos: { where: { deletedAt: null }, select: { id: true, amount: true } },
        },
        orderBy: { scheduledDate: 'desc' },
      }),
    ]);

    // Build per-project breakdown
    const projectMap = new Map<
      string,
      { id: string; name: string; code: string; spent: number; pending: number; gastosCount: number; ordersCount: number }
    >();

    for (const g of gastos) {
      const k = g.project.id;
      const e = projectMap.get(k) ?? {
        id: g.project.id,
        name: g.project.name,
        code: g.project.code,
        spent: 0,
        pending: 0,
        gastosCount: 0,
        ordersCount: 0,
      };
      e.spent += g.amount;
      e.gastosCount += 1;
      projectMap.set(k, e);
    }

    for (const o of orders) {
      const paid = o.gastos.reduce((s, x) => s + x.amount, 0);
      const remaining = Math.max(0, o.amount - paid);
      const k = o.project.id;
      const e = projectMap.get(k) ?? {
        id: o.project.id,
        name: o.project.name,
        code: o.project.code,
        spent: 0,
        pending: 0,
        gastosCount: 0,
        ordersCount: 0,
      };
      if (o.status === 'PENDING') e.pending += remaining;
      e.ordersCount += 1;
      projectMap.set(k, e);
    }

    const projects = Array.from(projectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const totalSpent = gastos.reduce((s, g) => s + g.amount, 0);
    const totalDebt = orders.reduce((s, o) => {
      if (o.status !== 'PENDING') return s;
      const paid = o.gastos.reduce((x, y) => x + y.amount, 0);
      return s + Math.max(0, o.amount - paid);
    }, 0);

    return success(res, {
      provider,
      totals: { totalSpent, totalDebt },
      projects,
      gastos: gastos.map((g) => ({
        id: g.id,
        description: g.description,
        amount: g.amount,
        gastoDate: g.gastoDate,
        invoiceNumber: g.invoiceNumber,
        project: g.project,
        rubro: g.rubro,
      })),
      orders: orders.map((o) => {
        const paid = o.gastos.reduce((s, x) => s + x.amount, 0);
        return {
          id: o.id,
          description: o.description,
          amount: o.amount,
          paidAmount: paid,
          pendingAmount: Math.max(0, o.amount - paid),
          status: o.status,
          scheduledDate: o.scheduledDate,
          paidAt: o.paidAt,
          invoiceNumber: o.invoiceNumber,
          project: o.project,
          rubro: o.rubro,
        };
      }),
    });
  }),
);

providersRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROVIDERS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.provider.create({
      data: {
        name: req.body.name,
        ruc: req.body.ruc || null,
        phone: req.body.phone || null,
        email: req.body.email || null,
        service: req.body.service || null,
        createdBy: req.user.id,
      },
    });
    return success(res, created, 201);
  }),
);

providersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROVIDERS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.provider.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Proveedor no encontrado');
    const updated = await prisma.provider.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        ruc: req.body.ruc !== undefined ? req.body.ruc || null : undefined,
        phone: req.body.phone !== undefined ? req.body.phone || null : undefined,
        email: req.body.email !== undefined ? req.body.email || null : undefined,
        service: req.body.service !== undefined ? req.body.service || null : undefined,
      },
    });
    return success(res, updated);
  }),
);

providersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROVIDERS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.provider.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Proveedor eliminado' });
  }),
);
