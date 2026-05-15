import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';
import type { CreateProjectDto, UpdateProjectDto } from './projects.validation';

type RubroStatus = 'ok' | 'warn' | 'danger' | 'exhausted';

const STATUS_THRESHOLDS = {
  WARN_BELOW_PERCENT: 25,
} as const;

function classifyRubro(budgeted: number, spent: number): { balance: number; percentFree: number; status: RubroStatus } {
  const balance = budgeted - spent;
  const percentFree = budgeted > 0 ? Math.max(0, Math.round((balance / budgeted) * 100)) : 0;
  let status: RubroStatus = 'ok';
  if (balance < 0) status = 'danger';
  else if (balance === 0) status = 'exhausted';
  else if (percentFree < STATUS_THRESHOLDS.WARN_BELOW_PERCENT) status = 'warn';
  return { balance, percentFree, status };
}

export class ProjectsService {
  static list(skip: number, take: number) {
    return prisma.$transaction([
      prisma.project.findMany({
        where: { deletedAt: null },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where: { deletedAt: null } }),
    ]);
  }

  static async getById(id: string) {
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { rubros: true, gastos: true, planillas: true } },
      },
    });
    if (!project) throw new NotFoundError(ERRORS.PROJECT_NOT_FOUND);
    return project;
  }

  /**
   * Resumen del proyecto: por cada rubro, cuánto presupuestado, gastado, saldo
   * y semáforo. Es lo que alimenta la pestaña "Presupuesto" del frontend.
   */
  static async getSummary(id: string) {
    const project = await this.getById(id);

    const rubros = await prisma.rubro.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });

    const gastosByRubro = await prisma.gasto.groupBy({
      by: ['rubroId'],
      where: { projectId: id, deletedAt: null },
      _sum: { amount: true },
    });

    const spentMap = new Map<string, number>();
    for (const g of gastosByRubro) {
      spentMap.set(g.rubroId, Number(g._sum.amount ?? 0));
    }

    let totalBudgeted = 0;
    let totalSpent = 0;
    const rubrosWithMetrics = rubros.map((r) => {
      const budgeted = Number(r.budgetedAmount);
      const spent = spentMap.get(r.id) ?? 0;
      const { balance, percentFree, status } = classifyRubro(budgeted, spent);
      totalBudgeted += budgeted;
      totalSpent += spent;
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        unit: r.unit,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unitPrice),
        budgetedAmount: budgeted,
        spent,
        balance,
        percentFree,
        status,
      };
    });

    const contractAmount = Number(project.contractAmount);
    const advanceAmount = contractAmount * (Number(project.advancePercent) / 100);

    // ----- Cálculos de IVA y retenciones -----
    const vatPercent = Number(project.vatPercent ?? 15);
    const vatIncluded = Boolean(project.vatIncluded);
    const isWithholdingAgent = Boolean(project.isWithholdingAgent);
    const vatRetentionPercent = Number(project.vatRetentionPercent ?? 0);
    const incomeRetentionPercent = Number(project.incomeRetentionPercent ?? 0);

    // Base sin IVA y valor con IVA según cómo el usuario ingresó el contrato.
    const contractBase = vatIncluded
      ? contractAmount / (1 + vatPercent / 100)
      : contractAmount;
    const contractVatAmount = contractBase * (vatPercent / 100);
    const contractGross = contractBase + contractVatAmount;

    // Retenciones esperadas (solo si el cliente es agente de retención).
    const vatRetention = isWithholdingAgent
      ? contractVatAmount * (vatRetentionPercent / 100)
      : 0;
    const incomeRetention = isWithholdingAgent
      ? contractBase * (incomeRetentionPercent / 100)
      : 0;
    const totalRetentions = vatRetention + incomeRetention;
    const netReceivable = contractGross - totalRetentions;

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        contractor: project.contractor,
        contractAmount,
        advancePercent: Number(project.advancePercent),
        advanceAmount,
        guaranteePercent: Number(project.guaranteePercent),
        vatPercent,
        vatIncluded,
        isWithholdingAgent,
        vatRetentionPercent,
        incomeRetentionPercent,
        // Valores derivados:
        contractBase,
        contractVatAmount,
        contractGross,
        vatRetention,
        incomeRetention,
        totalRetentions,
        netReceivable,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
      },
      rubros: rubrosWithMetrics,
      totals: {
        budgeted: totalBudgeted,
        spent: totalSpent,
        balance: totalBudgeted - totalSpent,
        progress: contractAmount > 0 ? totalSpent / contractAmount : 0,
      },
    };
  }

  static create(dto: CreateProjectDto, createdBy: string) {
    return prisma.project.create({
      data: {
        code: dto.code,
        name: dto.name,
        contractor: dto.contractor ?? null,
        description: dto.description ?? null,
        city: dto.city ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        contractAmount: dto.contractAmount,
        advancePercent: dto.advancePercent ?? 40,
        guaranteePercent: dto.guaranteePercent ?? 5,
        vatPercent: dto.vatPercent ?? 15,
        vatIncluded: dto.vatIncluded ?? false,
        isWithholdingAgent: dto.isWithholdingAgent ?? false,
        vatRetentionPercent: dto.vatRetentionPercent ?? 0,
        incomeRetentionPercent: dto.incomeRetentionPercent ?? 0,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        status: dto.status ?? 'DRAFT',
        createdBy,
      },
    });
  }

  /**
   * Estadísticas globales (todos los proyectos del usuario) para el Dashboard.
   * Devuelve un objeto por proyecto con totals + ciudad + estado, calculado en una sola query.
   */
  static async getGlobalStats() {
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (projects.length === 0) {
      return {
        projects: [],
        totals: {
          contractAmount: 0,
          budgeted: 0,
          spent: 0,
          balance: 0,
          pendingOrders: 0,
          planillado: 0,
          porCobrar: 0,
          activeCount: 0,
        },
      };
    }

    const projectIds = projects.map((p) => p.id);

    const [budgetedAgg, spentAgg, ordersAgg, planillasAll] = await Promise.all([
      prisma.rubro.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, deletedAt: null },
        _sum: { budgetedAmount: true },
      }),
      prisma.gasto.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.paymentOrder.findMany({
        where: { projectId: { in: projectIds }, deletedAt: null, status: 'PENDING' },
        include: { gastos: { where: { deletedAt: null }, select: { amount: true } } },
      }),
      prisma.planilla.findMany({
        where: { projectId: { in: projectIds }, deletedAt: null },
        select: {
          projectId: true,
          status: true,
          totalCurrent: true,
          netPayable: true,
        },
      }),
    ]);

    const budgetedMap = new Map(budgetedAgg.map((b) => [b.projectId, Number(b._sum.budgetedAmount ?? 0)]));
    const spentMap = new Map(spentAgg.map((s) => [s.projectId, Number(s._sum.amount ?? 0)]));

    const pendingByProject = new Map<string, number>();
    let globalPending = 0;
    for (const o of ordersAgg) {
      const paid = o.gastos.reduce((s, g) => s + g.amount, 0);
      const remaining = Math.max(0, o.amount - paid);
      pendingByProject.set(o.projectId, (pendingByProject.get(o.projectId) ?? 0) + remaining);
      globalPending += remaining;
    }

    // Planillado: suma de totalCurrent de planillas APPROVED o PAID
    // Por cobrar: suma de netPayable de planillas SUBMITTED o APPROVED (no PAID)
    const planilladoByProject = new Map<string, number>();
    const porCobrarByProject = new Map<string, number>();
    let globalPlanillado = 0;
    let globalPorCobrar = 0;
    for (const pl of planillasAll) {
      const current = Number(pl.totalCurrent);
      const net = Number(pl.netPayable);
      if (pl.status === 'APPROVED' || pl.status === 'PAID') {
        planilladoByProject.set(pl.projectId, (planilladoByProject.get(pl.projectId) ?? 0) + current);
        globalPlanillado += current;
      }
      if (pl.status === 'SUBMITTED' || pl.status === 'APPROVED') {
        porCobrarByProject.set(pl.projectId, (porCobrarByProject.get(pl.projectId) ?? 0) + net);
        globalPorCobrar += net;
      }
    }

    let totalContract = 0;
    let totalBudgeted = 0;
    let totalSpent = 0;
    let activeCount = 0;

    const enriched = projects.map((p) => {
      const contractAmount = Number(p.contractAmount);
      const budgeted = budgetedMap.get(p.id) ?? 0;
      const spent = spentMap.get(p.id) ?? 0;
      const pending = pendingByProject.get(p.id) ?? 0;
      const planillado = planilladoByProject.get(p.id) ?? 0;
      const porCobrar = porCobrarByProject.get(p.id) ?? 0;
      const progressContract = contractAmount > 0 ? spent / contractAmount : 0;
      const progressBudget = budgeted > 0 ? spent / budgeted : 0;
      totalContract += contractAmount;
      totalBudgeted += budgeted;
      totalSpent += spent;
      if (p.status === 'ACTIVE') activeCount += 1;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        contractor: p.contractor,
        city: p.city,
        latitude: p.latitude,
        longitude: p.longitude,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        contractAmount,
        budgeted,
        spent,
        pending,
        planillado,
        porCobrar,
        balance: budgeted - spent,
        progressContract: Math.min(1, progressContract),
        progressBudget: Math.min(1, progressBudget),
      };
    });

    return {
      projects: enriched,
      totals: {
        contractAmount: totalContract,
        budgeted: totalBudgeted,
        spent: totalSpent,
        balance: totalBudgeted - totalSpent,
        pendingOrders: globalPending,
        planillado: globalPlanillado,
        porCobrar: globalPorCobrar,
        activeCount,
      },
    };
  }

  static async update(id: string, dto: UpdateProjectDto) {
    await this.getById(id);
    return prisma.project.update({ where: { id }, data: dto });
  }

  static async softDelete(id: string) {
    await this.getById(id);
    await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
