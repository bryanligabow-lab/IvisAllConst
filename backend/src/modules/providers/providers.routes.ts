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

const createSchema = z.object({
  name: z.string().min(1).max(200),
  ruc: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  service: z.string().max(300).optional(),
  isSubcontractor: z.coerce.boolean().optional(),
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
      const [spentAgg, subAgg, ordersAll] = await Promise.all([
        prisma.gasto.aggregate({
          _sum: { amount: true },
          where: { providerId: p.id, deletedAt: null, ...projectFilter },
        }),
        prisma.gasto.aggregate({
          _sum: { amount: true },
          where: { providerId: p.id, deletedAt: null, kind: 'SUBCONTRACTOR', ...projectFilter },
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
      const projectsWithDebt = new Set<string>();

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
        // Total de anticipos/gastos como subcontratista (kind=SUBCONTRACTOR).
        totalSubcontract: subAgg._sum.amount ?? 0,
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
    const onlySub = req.query.subcontractor === 'true';
    const stats = await computeProviderStats(projectId);

    // Solo subcontratistas: marcados como tal o con anticipos como subcontratista.
    if (onlySub) {
      return success(
        res,
        stats.filter((s) => s.isSubcontractor || Number(s.totalSubcontract) > 0),
      );
    }

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

    const [gastos, orders, subcontracts] = await Promise.all([
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
      // Valores subcontratados acordados por proyecto (los edita Bryan en la ficha).
      prisma.projectSubcontract.findMany({
        where: { providerId: provider.id },
        include: { project: { select: { id: true, name: true, code: true, deletedAt: true } } },
      }),
    ]);

    // Build per-project breakdown
    interface ProjectRow {
      id: string;
      name: string;
      code: string;
      subcontractAmount: number; // valor acordado (editable)
      spent: number; // lo que ya se le ha dado
      pending: number; // pendiente de órdenes
      gastosCount: number;
      ordersCount: number;
    }
    const projectMap = new Map<string, ProjectRow>();
    const ensure = (p: { id: string; name: string; code: string }): ProjectRow => {
      const e = projectMap.get(p.id) ?? {
        id: p.id,
        name: p.name,
        code: p.code,
        subcontractAmount: 0,
        spent: 0,
        pending: 0,
        gastosCount: 0,
        ordersCount: 0,
      };
      projectMap.set(p.id, e);
      return e;
    };

    // Primero los subcontratos acordados (aunque no tengan gastos todavía).
    for (const s of subcontracts) {
      if (s.project.deletedAt) continue;
      const e = ensure(s.project);
      e.subcontractAmount = s.amount;
    }

    for (const g of gastos) {
      const e = ensure(g.project);
      e.spent += g.amount;
      e.gastosCount += 1;
    }

    for (const o of orders) {
      const paid = o.gastos.reduce((s, x) => s + x.amount, 0);
      const remaining = Math.max(0, o.amount - paid);
      const e = ensure(o.project);
      if (o.status === 'PENDING') e.pending += remaining;
      e.ordersCount += 1;
    }

    const projects = Array.from(projectMap.values())
      .map((p) => ({ ...p, balance: p.subcontractAmount - p.spent }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalSubcontracted = projects.reduce((s, p) => s + p.subcontractAmount, 0);

    const totalSpent = gastos.reduce((s, g) => s + g.amount, 0);
    const totalDebt = orders.reduce((s, o) => {
      if (o.status !== 'PENDING') return s;
      const paid = o.gastos.reduce((x, y) => x + y.amount, 0);
      return s + Math.max(0, o.amount - paid);
    }, 0);

    return success(res, {
      provider,
      totals: {
        totalSpent,
        totalDebt,
        totalSubcontracted,
        totalBalance: totalSubcontracted - totalSpent,
      },
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

// Fija/edita el valor subcontratado acordado a este proveedor para un proyecto.
// amount = 0 elimina el registro (deja el proyecto sin subcontrato acordado).
const subcontractSchema = z.object({
  projectId: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  notes: z.string().max(300).nullish(),
});
providersRouter.put(
  '/:id/subcontract',
  requirePermission(PERMISSIONS.PROVIDERS_WRITE),
  validate(idParamSchema, 'params'),
  validate(subcontractSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const provider = await prisma.provider.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!provider) throw new NotFoundError('Proveedor no encontrado');
    const project = await prisma.project.findFirst({
      where: { id: req.body.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError('Proyecto no encontrado');

    if (req.body.amount === 0) {
      await prisma.projectSubcontract.deleteMany({
        where: { providerId: provider.id, projectId: project.id },
      });
      return success(res, { removed: true });
    }
    const saved = await prisma.projectSubcontract.upsert({
      where: { projectId_providerId: { projectId: project.id, providerId: provider.id } },
      update: { amount: req.body.amount, notes: req.body.notes ?? null },
      create: {
        projectId: project.id,
        providerId: provider.id,
        amount: req.body.amount,
        notes: req.body.notes ?? null,
        createdBy: req.user.id,
      },
    });
    return success(res, saved);
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
        isSubcontractor: req.body.isSubcontractor ?? false,
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
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.provider.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Proveedor eliminado' });
  }),
);
