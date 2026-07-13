import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';

export const INGRESO_KINDS = ['ANTICIPO', 'PLANILLA', 'OTRO'] as const;
export type IngresoKind = (typeof INGRESO_KINDS)[number];

interface CreateIngresoInput {
  projectId: string;
  planillaId?: string | null;
  kind: IngresoKind;
  amount: number;
  ingresoDate: Date;
  entity?: string;
  invoiceNumber?: string;
  reference?: string;
  notes?: string;
  // Documento adjunto (PDF/foto de la planilla). base64 sin prefijo.
  documentBase64?: string | null;
  documentMime?: string | null;
  documentName?: string | null;
}

type UpdateIngresoInput = Partial<Omit<CreateIngresoInput, 'projectId'>>;

// Estados de planilla que cuentan como "presentada" (ya salió de borrador).
const PRESENTED_STATUSES = ['SUBMITTED', 'FISCALIZACION', 'CONTRALORIA', 'APPROVED', 'PAID'];
// Presentadas pero aún no pagadas: es lo que está por cobrar.
const RECEIVABLE_STATUSES = ['SUBMITTED', 'FISCALIZACION', 'CONTRALORIA', 'APPROVED'];

export class IngresosService {
  static async list(projectId: string) {
    // Excluimos el binario del documento de la lista (puede ser pesado).
    const items = await prisma.ingreso.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { ingresoDate: 'desc' },
      omit: { documentData: true },
      include: {
        planilla: { select: { id: true, number: true, title: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
    });
    return items.map((it) => ({ ...it, hasDocument: !!it.documentMime }));
  }

  // Facturas cobradas (conciliación) de un proyecto, con su devengo y fondo.
  static facturas(projectId: string) {
    return prisma.factura.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { invoiceNumber: 'asc' },
    });
  }

  static async getDocument(id: string) {
    const ingreso = await prisma.ingreso.findFirst({
      where: { id, deletedAt: null },
      select: { documentData: true, documentMime: true, documentName: true, projectId: true },
    });
    if (!ingreso || !ingreso.documentData) throw new NotFoundError(ERRORS.INGRESO_NOT_FOUND);
    return ingreso;
  }

  static async getById(id: string) {
    const ingreso = await prisma.ingreso.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ingreso) throw new NotFoundError(ERRORS.INGRESO_NOT_FOUND);
    return ingreso;
  }

  private static async assertPlanillaInProject(planillaId: string, projectId: string) {
    const planilla = await prisma.planilla.findFirst({
      where: { id: planillaId, projectId, deletedAt: null },
    });
    if (!planilla) throw new NotFoundError(ERRORS.PLANILLA_NOT_FOUND);
  }

  static async create(input: CreateIngresoInput, createdBy: string) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      include: { client: { select: { name: true } } },
    });
    if (!project) throw new NotFoundError(ERRORS.PROJECT_NOT_FOUND);
    if (input.planillaId) {
      await this.assertPlanillaInProject(input.planillaId, input.projectId);
    }

    return prisma.ingreso.create({
      data: {
        projectId: input.projectId,
        planillaId: input.planillaId || null,
        kind: input.kind,
        amount: input.amount,
        ingresoDate: input.ingresoDate,
        // Si no indican quién paga, usamos el cliente del proyecto.
        entity: input.entity?.trim() || project.client?.name || project.contractor || null,
        invoiceNumber: input.invoiceNumber?.trim() || null,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        documentData: input.documentBase64
          ? Buffer.from(input.documentBase64, 'base64')
          : null,
        documentMime: input.documentBase64 ? input.documentMime || null : null,
        documentName: input.documentBase64 ? input.documentName || null : null,
        createdBy,
      },
      omit: { documentData: true },
    });
  }

  static async update(id: string, input: UpdateIngresoInput) {
    const existing = await this.getById(id);
    if (input.planillaId) {
      await this.assertPlanillaInProject(input.planillaId, existing.projectId);
    }
    return prisma.ingreso.update({
      where: { id },
      data: {
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.ingresoDate !== undefined ? { ingresoDate: input.ingresoDate } : {}),
        ...(input.planillaId !== undefined ? { planillaId: input.planillaId || null } : {}),
        ...(input.entity !== undefined ? { entity: input.entity?.trim() || null } : {}),
        ...(input.invoiceNumber !== undefined
          ? { invoiceNumber: input.invoiceNumber?.trim() || null }
          : {}),
        ...(input.reference !== undefined ? { reference: input.reference?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        // Documento: si viene documentBase64 se reemplaza; si viene null explícito se quita.
        ...(input.documentBase64 !== undefined
          ? {
              documentData: input.documentBase64
                ? Buffer.from(input.documentBase64, 'base64')
                : null,
              documentMime: input.documentBase64 ? input.documentMime || null : null,
              documentName: input.documentBase64 ? input.documentName || null : null,
            }
          : {}),
      },
      omit: { documentData: true },
    });
  }

  static async softDelete(id: string) {
    await this.getById(id);
    await prisma.ingreso.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Vista consolidada de TODOS los proyectos (apartado "Planillas"): por cada
   * proyecto su lista de planillas con estado + un resumen de cobro, más los
   * KPIs globales. Scopeado a los proyectos permitidos si viene la lista.
   */
  static async overview(allowedProjectIds?: string[]) {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(allowedProjectIds ? { id: { in: allowedProjectIds } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        client: { select: { name: true } },
        planillas: {
          where: { deletedAt: null, status: { not: 'CANCELLED' } },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            totalCurrent: true,
            netPayable: true,
            advanceAmortization: true,
            periodStart: true,
            periodEnd: true,
          },
        },
        ingresos: {
          where: { deletedAt: null },
          select: { kind: true, amount: true },
        },
      },
    });

    const totals = {
      projects: projects.length,
      planillado: 0,
      facturado: 0,
      porCobrar: 0,
      ingresado: 0,
      anticipos: 0,
      planillasIngreso: 0,
      totalPlanillas: 0,
      presentadas: 0,
      aprobadas: 0,
      pagadas: 0,
    };

    const rows = projects.map((p) => {
      let anticipos = 0;
      let planillasIngreso = 0;
      let otros = 0;
      for (const i of p.ingresos) {
        const amt = Number(i.amount);
        if (i.kind === 'ANTICIPO') anticipos += amt;
        else if (i.kind === 'PLANILLA') planillasIngreso += amt;
        else otros += amt;
      }
      const ingresado = anticipos + planillasIngreso + otros;

      let planillado = 0;
      let facturado = 0;
      let porCobrar = 0;
      let presentadas = 0;
      let aprobadas = 0;
      let pagadas = 0;
      for (const pl of p.planillas) {
        const current = Number(pl.totalCurrent);
        if (PRESENTED_STATUSES.includes(pl.status)) {
          presentadas += 1;
          planillado += current;
        }
        if (pl.status === 'APPROVED' || pl.status === 'PAID') {
          aprobadas += 1;
          facturado += current;
        }
        if (pl.status === 'PAID') pagadas += 1;
        if (RECEIVABLE_STATUSES.includes(pl.status)) porCobrar += Number(pl.netPayable);
      }

      totals.planillado += planillado;
      totals.facturado += facturado;
      totals.porCobrar += porCobrar;
      totals.ingresado += ingresado;
      totals.anticipos += anticipos;
      totals.planillasIngreso += planillasIngreso;
      totals.totalPlanillas += p.planillas.length;
      totals.presentadas += presentadas;
      totals.aprobadas += aprobadas;
      totals.pagadas += pagadas;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        clientName: p.client?.name ?? p.contractor ?? null,
        contractAmount: Number(p.contractAmount),
        planillas: p.planillas.map((pl) => {
          const cur = Number(pl.totalCurrent);
          const facturadoPl = pl.status === 'APPROVED' || pl.status === 'PAID' ? cur : 0;
          const porCobrarPl = RECEIVABLE_STATUSES.includes(pl.status) ? Number(pl.netPayable) : 0;
          return {
            id: pl.id,
            number: pl.number,
            title: pl.title,
            status: pl.status,
            totalCurrent: cur,
            facturado: facturadoPl,
            porCobrar: porCobrarPl,
            periodStart: pl.periodStart,
            periodEnd: pl.periodEnd,
          };
        }),
        summary: {
          planillado,
          facturado,
          porCobrar,
          ingresado,
          anticipos,
          presentadas,
          aprobadas,
          pagadas,
        },
      };
    });

    return { totals, projects: rows };
  }

  /**
   * Resumen financiero del cobro de un proyecto: contrato, anticipo recibido
   * vs devengado (amortizado en planillas), planillas presentadas/aprobadas/
   * pagadas, facturado, ingresado y por cobrar. Es el cuadro que la empresa
   * llevaba en Excel ("PROYECTOS AMBIESA"), ahora calculado del sistema.
   */
  static async summary(projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: { client: { select: { name: true } } },
    });
    if (!project) throw new NotFoundError(ERRORS.PROJECT_NOT_FOUND);

    const [ingresos, facturas, planillas] = await Promise.all([
      prisma.ingreso.findMany({
        where: { projectId, deletedAt: null },
        select: { kind: true, amount: true },
      }),
      prisma.factura.findMany({
        where: { projectId, deletedAt: null },
        select: { advanceAmortized: true, guaranteeRetained: true },
      }),
      prisma.planilla.findMany({
        where: { projectId, deletedAt: null, status: { not: 'CANCELLED' } },
        select: {
          status: true,
          totalCurrent: true,
          netPayable: true,
          advanceAmortization: true,
        },
      }),
    ]);

    let anticipoRecibido = 0;
    let ingresoPlanillas = 0;
    let otrosIngresos = 0;
    for (const i of ingresos) {
      const amount = Number(i.amount);
      if (i.kind === 'ANTICIPO') anticipoRecibido += amount;
      else if (i.kind === 'PLANILLA') ingresoPlanillas += amount;
      else otrosIngresos += amount;
    }
    const totalIngresado = anticipoRecibido + ingresoPlanillas + otrosIngresos;

    let presentadasCount = 0;
    let aprobadasCount = 0;
    let pagadasCount = 0;
    let totalPlanillado = 0;
    let facturado = 0;
    let porCobrar = 0;
    let devengado = 0;
    for (const p of planillas) {
      const current = Number(p.totalCurrent);
      if (PRESENTED_STATUSES.includes(p.status)) {
        presentadasCount += 1;
        totalPlanillado += current;
      }
      if (p.status === 'APPROVED' || p.status === 'PAID') {
        aprobadasCount += 1;
        facturado += current;
        // El anticipo se devenga (amortiza) cuando la planilla se aprueba.
        devengado += Number(p.advanceAmortization);
      }
      if (p.status === 'PAID') pagadasCount += 1;
      if (RECEIVABLE_STATUSES.includes(p.status)) porCobrar += Number(p.netPayable);
    }

    // Conciliación desde las facturas cargadas (estado de cuenta): devengo real
    // del anticipo y fondo de garantía retenido (por cobrar).
    let fondoGarantiaRetenido = 0;
    let devengadoFacturas = 0;
    for (const f of facturas) {
      fondoGarantiaRetenido += Number(f.guaranteeRetained);
      devengadoFacturas += Number(f.advanceAmortized);
    }

    const contractAmount = Number(project.contractAmount);
    const managesAdvance = Boolean(project.managesAdvance);
    const advanceExpected = managesAdvance
      ? contractAmount * (Number(project.advancePercent) / 100)
      : 0;

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        clientName: project.client?.name ?? project.contractor ?? null,
        contractAmount,
        managesAdvance,
        advancePercent: Number(project.advancePercent),
        advanceExpected,
      },
      anticipo: {
        recibido: anticipoRecibido,
        devengado,
        // Lo que aún debemos "trabajar" del anticipo que nos dieron.
        saldoPorDevengar: anticipoRecibido - devengado,
      },
      planillas: {
        total: planillas.length,
        presentadas: presentadasCount,
        aprobadas: aprobadasCount,
        pagadas: pagadasCount,
        totalPlanillado,
        facturado,
        porCobrar,
      },
      ingresos: {
        anticipos: anticipoRecibido,
        planillas: ingresoPlanillas,
        otros: otrosIngresos,
        total: totalIngresado,
      },
      // Conciliación con el estado de cuenta (facturas cargadas).
      garantia: {
        retenido: fondoGarantiaRetenido, // fondo de garantía por cobrar
      },
      facturas: {
        count: facturas.length,
        devengoAnticipo: devengadoFacturas, // anticipo devengado según facturas
      },
    };
  }
}
