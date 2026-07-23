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
  ivaAmount: number;
  advanceAmortization: number;
  guaranteeRetention: number;
  ivaRetention: number;
  incomeRetention: number;
  advancePlanillaAmort: number;
  otherDiscount: number;
  netPayable: number;
}

interface ProjectTaxOpts {
  advancePercent: number;
  guaranteePercent: number;
  vatPercent: number;
  vatRetentionPercent: number;
  incomeRetentionPercent: number;
  isWithholdingAgent: boolean;
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
  /**
   * Calcula IVA, retenciones (IVA y renta), amortización de anticipo y fondo de
   * garantía sobre el valor (base) de la planilla, y el neto a pagar.
   * Neto = (base + IVA) − retención IVA − retención renta − amortización − fondo.
   */
  private static computeTotals(
    totalCurrent: number,
    totalPrevious: number,
    opts: ProjectTaxOpts,
  ): ComputedTotals {
    const d = PERCENT_DIVISOR;
    const ivaAmount = totalCurrent * (opts.vatPercent / d);
    const advanceAmortization = totalCurrent * (opts.advancePercent / d);
    const guaranteeRetention = totalCurrent * (opts.guaranteePercent / d);
    const ivaRetention = opts.isWithholdingAgent
      ? ivaAmount * (opts.vatRetentionPercent / d)
      : 0;
    const incomeRetention = opts.isWithholdingAgent
      ? totalCurrent * (opts.incomeRetentionPercent / d)
      : 0;
    const netPayable =
      totalCurrent +
      ivaAmount -
      ivaRetention -
      incomeRetention -
      advanceAmortization -
      guaranteeRetention;
    return {
      totalCurrent,
      totalPrevious,
      totalAccumulated: totalCurrent + totalPrevious,
      ivaAmount,
      advanceAmortization,
      guaranteeRetention,
      ivaRetention,
      incomeRetention,
      advancePlanillaAmort: 0,
      otherDiscount: 0,
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
    const taxOpts: ProjectTaxOpts = {
      advancePercent: project.managesAdvance ? Number(project.advancePercent) : 0,
      guaranteePercent: Number(project.guaranteePercent),
      vatPercent: Number(project.vatPercent),
      vatRetentionPercent: Number(project.vatRetentionPercent),
      incomeRetentionPercent: Number(project.incomeRetentionPercent),
      isWithholdingAgent: Boolean(project.isWithholdingAgent),
    };

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
      // Las planillas con valores reales del estado de cuenta no se recalculan;
      // solo mantenemos su acumulado por si cambia una planilla anterior.
      if (p.manualTotals) {
        await prisma.planilla.update({
          where: { id: p.id },
          data: { totalPrevious, totalAccumulated: totalCurrent + totalPrevious },
        });
        continue;
      }
      const totals = this.computeTotals(totalCurrent, totalPrevious, taxOpts);
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

    const totals = this.computeTotals(totalCurrent, totalPrevious, {
      advancePercent: project.managesAdvance ? Number(project.advancePercent) : 0,
      guaranteePercent: Number(project.guaranteePercent),
      vatPercent: Number(project.vatPercent),
      vatRetentionPercent: Number(project.vatRetentionPercent),
      incomeRetentionPercent: Number(project.incomeRetentionPercent),
      isWithholdingAgent: Boolean(project.isWithholdingAgent),
    });

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

  /**
   * Guarda el valor ESTIMADO de una planilla (conciliación de pendientes). Es
   * un dato informativo que escribe gerencia mientras la planilla no sale
   * oficialmente; no toca los cálculos ni el estado. `amount = null` lo limpia.
   */
  static async setEstimate(id: string, amount: number | null, note?: string | null) {
    await this.getById(id); // valida que exista
    return prisma.planilla.update({
      where: { id },
      data: {
        estimatedAmount: amount,
        estimatedNote: note?.trim() ? note.trim() : null,
      },
    });
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

  /**
   * Reconcilia las planillas de un proyecto con el estado de cuenta: fija los
   * valores reales (IVA, retenciones, amortizaciones, fondo, neto) marcándolas
   * como manuales, y reemplaza los pagos (ingresos de planilla) por los reales.
   */
  static async reconcile(
    projectId: string,
    items: Array<{
      planillaId: string;
      ivaAmount: number;
      ivaRetention: number;
      incomeRetention: number;
      advanceAmortization: number;
      guaranteeRetention: number;
      advancePlanillaAmort: number;
      otherDiscount: number;
      netPayable: number;
      paid: number;
    }>,
    createdBy: string,
  ) {
    // Limpiar TODOS los pagos de planilla del proyecto (viejos/aproximados).
    await prisma.ingreso.updateMany({
      where: { projectId, kind: 'PLANILLA', deletedAt: null },
      data: { deletedAt: new Date() },
    });

    for (const it of items) {
      const pl = await prisma.planilla.findFirst({
        where: { id: it.planillaId, projectId, deletedAt: null },
        include: { project: { include: { client: { select: { name: true } } } } },
      });
      if (!pl) continue;
      await prisma.planilla.update({
        where: { id: it.planillaId },
        data: {
          ivaAmount: it.ivaAmount,
          ivaRetention: it.ivaRetention,
          incomeRetention: it.incomeRetention,
          advanceAmortization: it.advanceAmortization,
          guaranteeRetention: it.guaranteeRetention,
          advancePlanillaAmort: it.advancePlanillaAmort,
          otherDiscount: it.otherDiscount,
          netPayable: it.netPayable,
          manualTotals: true,
        },
      });
      if (it.paid > 0) {
        await prisma.ingreso.create({
          data: {
            projectId,
            planillaId: it.planillaId,
            kind: 'PLANILLA',
            amount: it.paid,
            ingresoDate: pl.periodEnd,
            entity: pl.project.client?.name ?? pl.project.contractor ?? null,
            reference: `Cobro planilla #${pl.number} (estado de cuenta)`,
            createdBy,
          },
        });
      }
    }
    await this.recomputeProjectTotals(projectId);
    return { reconciled: items.length };
  }
}
