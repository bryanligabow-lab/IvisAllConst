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

/**
 * Flujo real de cobro de una planilla (en orden):
 * DRAFT (elaborándose) → SUBMITTED (presentada) → FISCALIZACION →
 * CONTRALORIA → APPROVED (aprobada) → PAID (pagada). CANCELLED anula.
 */
export const PLANILLA_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'FISCALIZACION',
  'CONTRALORIA',
  'APPROVED',
  'PAID',
  'CANCELLED',
] as const;
export type PlanillaStatus = (typeof PLANILLA_STATUSES)[number];

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

    // Proyectos sin anticipo (managesAdvance = false) no amortizan nada.
    const advancePct = project.managesAdvance ? Number(project.advancePercent) : 0;
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
      include: {
        // Últimos movimientos para mostrar el seguimiento sin otra petición.
        statusEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { creator: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  static async getById(id: string) {
    const planilla = await prisma.planilla.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { include: { rubro: true } },
        project: true,
        statusEvents: {
          orderBy: { createdAt: 'desc' },
          include: { creator: { select: { firstName: true, lastName: true } } },
        },
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
      project.managesAdvance ? Number(project.advancePercent) : 0,
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
        statusEvents: {
          create: { status: 'DRAFT', note: 'Planilla creada', createdBy },
        },
      },
      include: { items: true },
    });

    // Recompute all planillas to keep cumulative figures coherent.
    await this.recomputeProjectTotals(input.projectId);

    return created;
  }

  static async updateStatus(id: string, status: PlanillaStatus, changedBy: string, note?: string) {
    const existing = await this.getById(id);
    const [updated] = await prisma.$transaction([
      prisma.planilla.update({ where: { id }, data: { status } }),
      // Queda en el historial quién movió la planilla, a qué estado y con qué nota.
      prisma.planillaStatusEvent.create({
        data: { planillaId: id, status, note: note?.trim() || null, createdBy: changedBy },
      }),
    ]);
    // Status changes can affect downstream "planilla anterior" totals.
    await this.recomputeProjectTotals(existing.projectId);
    // Al marcar PAGADA se registra el ingreso automáticamente; si se saca de
    // pagada, se quita ese ingreso automático.
    await this.syncPaidIngreso(id, status, changedBy);
    return updated;
  }

  /** Prefijo de la referencia de los ingresos creados automáticamente al pagar. */
  private static readonly AUTO_INGRESO_REF = 'Cobro automático de planilla';

  private static async syncPaidIngreso(
    planillaId: string,
    status: PlanillaStatus,
    createdBy: string,
  ) {
    const planilla = await prisma.planilla.findFirst({
      where: { id: planillaId, deletedAt: null },
      include: { project: { include: { client: { select: { name: true } } } } },
    });
    if (!planilla) return;

    const existingAuto = await prisma.ingreso.findFirst({
      where: {
        planillaId,
        deletedAt: null,
        reference: { startsWith: this.AUTO_INGRESO_REF },
      },
    });

    if (status === 'PAID') {
      if (existingAuto) return; // ya se registró
      const amount = Number(planilla.netPayable) || Number(planilla.totalCurrent);
      if (amount <= 0) return;
      await prisma.ingreso.create({
        data: {
          projectId: planilla.projectId,
          planillaId,
          kind: 'PLANILLA',
          amount,
          ingresoDate: new Date(),
          entity: planilla.project.client?.name ?? planilla.project.contractor ?? null,
          reference: `${this.AUTO_INGRESO_REF} #${planilla.number}`,
          createdBy,
        },
      });
    } else if (existingAuto) {
      // Dejó de estar pagada → quitar el ingreso automático.
      await prisma.ingreso.update({
        where: { id: existingAuto.id },
        data: { deletedAt: new Date() },
      });
    }
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
