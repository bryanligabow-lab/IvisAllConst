import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';

interface PlanillaItemInput {
  rubroId: string;
  executedQuantity: number;
  currentAmount: number;
  notes?: string;
}

interface CreatePlanillaInput {
  projectId: string;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  items: PlanillaItemInput[];
}

interface ComputedTotals {
  totalCurrent: number;
  totalPrevious: number;
  totalAccumulated: number;
  advanceAmortization: number;
  guaranteeRetention: number;
  netPayable: number;
}

const PERCENT_DIVISOR = 100;

export class PlanillasService {
  /** Calcula amortización de anticipo y fondo de garantía sobre el valor de la planilla. */
  private static computeTotals(
    totalCurrent: number,
    totalPrevious: number,
    advancePercent: number,
    guaranteePercent: number,
  ): ComputedTotals {
    const advanceAmortization = totalCurrent * (advancePercent / PERCENT_DIVISOR);
    const guaranteeRetention = totalCurrent * (guaranteePercent / PERCENT_DIVISOR);
    const netPayable = totalCurrent - advanceAmortization - guaranteeRetention;
    return {
      totalCurrent,
      totalPrevious,
      totalAccumulated: totalCurrent + totalPrevious,
      advanceAmortization,
      guaranteeRetention,
      netPayable,
    };
  }

  /** Suma acumulada por rubro de las planillas anteriores aprobadas/pagadas. */
  private static async getPreviousAccumulatedByRubro(projectId: string): Promise<Map<string, number>> {
    const items = await prisma.planillaItem.findMany({
      where: {
        rubroId: { not: undefined },
        planilla: { projectId, deletedAt: null, status: { in: ['APPROVED', 'PAID'] } },
      },
      select: { rubroId: true, currentAmount: true },
    });
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.rubroId, (map.get(it.rubroId) ?? 0) + Number(it.currentAmount));
    }
    return map;
  }

  static async list(projectId: string) {
    return prisma.planilla.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { number: 'asc' },
    });
  }

  static async getById(id: string) {
    const planilla = await prisma.planilla.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { include: { rubro: true } },
        project: true,
      },
    });
    if (!planilla) throw new NotFoundError(ERRORS.PLANILLA_NOT_FOUND);
    return planilla;
  }

  static async create(input: CreatePlanillaInput, createdBy: string) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundError(ERRORS.PROJECT_NOT_FOUND);

    // Asignar siguiente número de planilla
    const last = await prisma.planilla.findFirst({
      where: { projectId: input.projectId, deletedAt: null },
      orderBy: { number: 'desc' },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    const previousMap = await this.getPreviousAccumulatedByRubro(input.projectId);

    let totalCurrent = 0;
    let totalPrevious = 0;
    const itemsToCreate = input.items.map((it) => {
      const prev = previousMap.get(it.rubroId) ?? 0;
      const accumulated = prev + it.currentAmount;
      totalCurrent += it.currentAmount;
      totalPrevious += prev;
      return {
        rubroId: it.rubroId,
        executedQuantity: it.executedQuantity,
        currentAmount: it.currentAmount,
        previousAmount: prev,
        accumulatedAmount: accumulated,
        notes: it.notes ?? null,
      };
    });

    const totals = this.computeTotals(
      totalCurrent,
      totalPrevious,
      Number(project.advancePercent),
      Number(project.guaranteePercent),
    );

    return prisma.planilla.create({
      data: {
        projectId: input.projectId,
        number: nextNumber,
        title: input.title,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdBy,
        ...totals,
        items: { createMany: { data: itemsToCreate } },
      },
      include: { items: true },
    });
  }

  static async updateStatus(id: string, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'CANCELLED') {
    await this.getById(id);
    return prisma.planilla.update({ where: { id }, data: { status } });
  }

  static async softDelete(id: string) {
    await this.getById(id);
    await prisma.planilla.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
