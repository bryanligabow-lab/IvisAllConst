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

  /**
   * Suma acumulada por rubro de las planillas anteriores. Incluye todos los
   * estados excepto CANCELLED — un borrador también cuenta para que las
   * cifras se vean correctas mientras se redacta el siguiente período.
   * Si `beforeNumber` se pasa, sólo se consideran planillas cuyo número es
   * estrictamente menor.
   */
  private static async getPreviousAccumulatedByRubro(
    projectId: string,
    beforeNumber?: number,
  ): Promise<Map<string, number>> {
    const items = await prisma.planillaItem.findMany({
      where: {
        rubroId: { not: undefined },
        planilla: {
          projectId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
          ...(beforeNumber !== undefined ? { number: { lt: beforeNumber } } : {}),
        },
      },
      select: { rubroId: true, currentAmount: true },
    });
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.rubroId, (map.get(it.rubroId) ?? 0) + Number(it.currentAmount));
    }
    return map;
  }

  /**
   * Recomputa los totales (previous / accumulated / amortización / fondo
   * garantía / total a pagar) de TODAS las planillas no canceladas de un
   * proyecto, en orden cronológico. Se llama después de crear o cambiar
   * el estado de una planilla para mantener todo coherente.
   */
  static async recomputeProjectTotals(projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) return;

    const advancePct = Number(project.advancePercent);
    const guaranteePct = Number(project.guaranteePercent);

    const planillas = await prisma.planilla.findMany({
      where: { projectId, deletedAt: null, status: { not: 'CANCELLED' } },
      orderBy: { number: 'asc' },
      include: { items: true },
    });

    // Tracks cumulative per rubro across planillas processed so far.
    const cumulative = new Map<string, number>();

    for (const p of planillas) {
      let totalCurrent = 0;
      let totalPrevious = 0;
      for (const it of p.items) {
        const prev = cumulative.get(it.rubroId) ?? 0;
        const cur = Number(it.currentAmount);
        const newAccum = prev + cur;
        totalCurrent += cur;
        totalPrevious += prev;
        cumulative.set(it.rubroId, newAccum);
        await prisma.planillaItem.update({
          where: { id: it.id },
          data: { previousAmount: prev, accumulatedAmount: newAccum },
        });
      }
      const totals = this.computeTotals(
        totalCurrent,
        totalPrevious,
        advancePct,
        guaranteePct,
      );
      await prisma.planilla.update({
        where: { id: p.id },
        data: totals,
      });
    }
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

    const created = await prisma.planilla.create({
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

    // Recompute all planillas to keep cumulative figures coherent.
    await this.recomputeProjectTotals(input.projectId);

    return created;
  }

  static async updateStatus(id: string, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'CANCELLED') {
    const existing = await this.getById(id);
    const updated = await prisma.planilla.update({ where: { id }, data: { status } });
    // Status changes can affect downstream "planilla anterior" totals.
    await this.recomputeProjectTotals(existing.projectId);
    return updated;
  }

  static async softDelete(id: string) {
    const existing = await this.getById(id);
    await prisma.planilla.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.recomputeProjectTotals(existing.projectId);
  }
}
