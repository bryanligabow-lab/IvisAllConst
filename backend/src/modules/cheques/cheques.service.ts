import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { CHEQUERAS_SEED, bankToChequeraId } from './chequeras.data';

export const CHEQUE_STATUSES = ['COBRADO', 'PENDIENTE', 'VENCIDO', 'ANULADO'] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

const chequeSelect = {
  id: true,
  issueDate: true,
  dueDate: true,
  number: true,
  beneficiary: true,
  bank: true,
  chequeraId: true,
  account: true,
  amount: true,
  cashDate: true,
  status: true,
  notes: true,
  groupId: true,
  installment: true,
} as const;

function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/** Fecha que manda para el cobro: la de cobro esperada (postfechado) o, si no, la de emisión. */
function effectiveDue(c: { dueDate?: Date | null; issueDate?: Date | null }): Date | null {
  return c.dueDate ?? c.issueDate ?? null;
}

/** Avisos por correo del financiamiento: a quiénes y cada cuándo. */
interface GroupNotifyInput {
  notifyEmails?: string[] | null;
  notifyWeekly?: boolean;
  notifyMonthly?: boolean;
  notifyDayBefore?: boolean;
  notifyOnDue?: boolean;
}

function avisosData(input: GroupNotifyInput) {
  return {
    ...(input.notifyEmails !== undefined
      ? {
          notifyEmails: (input.notifyEmails ?? [])
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        }
      : {}),
    ...(input.notifyWeekly !== undefined ? { notifyWeekly: input.notifyWeekly } : {}),
    ...(input.notifyMonthly !== undefined ? { notifyMonthly: input.notifyMonthly } : {}),
    ...(input.notifyDayBefore !== undefined ? { notifyDayBefore: input.notifyDayBefore } : {}),
    ...(input.notifyOnDue !== undefined ? { notifyOnDue: input.notifyOnDue } : {}),
  };
}

interface ChequeInput {
  issueDate?: Date | null;
  dueDate?: Date | null;
  chequeraId?: string | null;
  number?: string;
  beneficiary?: string | null;
  bank?: string | null;
  account?: string | null;
  amount?: number;
  cashDate?: Date | null;
  status?: string;
  notes?: string | null;
  groupId?: string | null;
  installment?: number | null;
}

export class ChequesService {
  // KPIs + próximos a cobrar (la "notificación" del panel).
  static async overview(days = 15) {
    const cheques = await prisma.cheque.findMany({
      where: { deletedAt: null },
      select: {
        ...chequeSelect,
        group: { select: { name: true } },
      },
    });

    const totals = {
      emitido: 0,
      cobrado: 0,
      pendiente: 0,
      anulado: 0,
      count: cheques.length,
      countPendiente: 0,
      countCobrado: 0,
    };
    const bancosSet = new Set<string>();
    for (const c of cheques) {
      if (c.status === 'ANULADO') {
        totals.anulado += c.amount;
        continue;
      }
      totals.emitido += c.amount;
      if (c.status === 'COBRADO') {
        totals.cobrado += c.amount;
        totals.countCobrado += 1;
      } else {
        totals.pendiente += c.amount;
        totals.countPendiente += 1;
      }
      if (c.bank) bancosSet.add(c.bank);
    }

    // Próximos a cobrar: pendientes cuya fecha ya llegó o llega en <= `days` días.
    const today = startOfToday();
    const limit = today + days * 86_400_000;
    const proximos = cheques
      .filter((c) => {
        if (c.status !== 'PENDIENTE') return false;
        const due = effectiveDue(c);
        return due != null && new Date(due).getTime() <= limit;
      })
      .map((c) => {
        const due = effectiveDue(c) as Date;
        const t = new Date(due).getTime();
        const diffDays = Math.round((t - today) / 86_400_000);
        return {
          id: c.id,
          number: c.number,
          beneficiary: c.beneficiary,
          bank: c.bank,
          amount: c.amount,
          issueDate: c.issueDate,
          dueDate: due,
          groupName: c.group?.name ?? null,
          daysUntil: diffDays, // negativo = ya debió cobrarse (atrasado)
          overdue: diffDays < 0,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      totals,
      proximos,
      proximosMonto: proximos.reduce((s, p) => s + p.amount, 0),
      bancos: [...bancosSet].sort((a, b) => a.localeCompare(b)),
    };
  }

  static async list(filter: {
    status?: string;
    bank?: string;
    q?: string;
    scope?: string; // 'registro' (default, groupId null) | 'all'
    chequeraId?: string;
    from?: string; // rango por fecha de cobro (calendario)
    to?: string;
  }) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filter.scope !== 'all') where.groupId = null;
    if (filter.status) where.status = filter.status;
    if (filter.bank) where.bank = filter.bank;
    if (filter.chequeraId) where.chequeraId = filter.chequeraId;
    if (filter.q) {
      where.OR = [
        { beneficiary: { contains: filter.q, mode: 'insensitive' } },
        { number: { contains: filter.q, mode: 'insensitive' } },
        { notes: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    // El rango mira la fecha de cobro esperada (dueDate) o, si no hay, la de emisión.
    if (filter.from || filter.to) {
      const range: Record<string, Date> = {};
      if (filter.from) {
        const desde = new Date(filter.from);
        desde.setUTCHours(0, 0, 0, 0);
        range.gte = desde;
      }
      if (filter.to) {
        // Hasta el FINAL del último día: las fechas se guardan al mediodía UTC,
        // así que un `lte` a medianoche dejaba fuera los cheques de ese día.
        const hasta = new Date(filter.to);
        hasta.setUTCHours(23, 59, 59, 999);
        range.lte = hasta;
      }
      where.AND = [{ OR: [{ dueDate: range }, { dueDate: null, issueDate: range }] }];
    }
    const items = await prisma.cheque.findMany({ where, select: chequeSelect });
    // Orden: la fecha MÁS PRÓXIMA a hoy primero. Con esta única regla, los
    // pendientes salen del que se cobra antes al que se cobra después, y los
    // cobrados del último cobrado hacia atrás. Los que no tienen fecha, al final.
    const hoy = startOfToday();
    const distancia = (c: (typeof items)[number]) => {
      const d = c.status === 'COBRADO' ? (c.cashDate ?? effectiveDue(c)) : effectiveDue(c);
      return d ? Math.abs(new Date(d).getTime() - hoy) : null;
    };
    return items.sort((a, b) => {
      const da = distancia(a);
      const db = distancia(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  /**
   * Marca como COBRADO todos los pendientes cuya fecha de cobro sea <= `until`.
   * Es la puesta al día del histórico ("todo lo de antes ya se cobró"), para que
   * solo queden pendientes los cheques de hoy en adelante.
   */
  static async bulkMarkCashedUntil(until: Date) {
    const candidatos = await prisma.cheque.findMany({
      where: { deletedAt: null, status: 'PENDIENTE' },
      select: { id: true, dueDate: true, issueDate: true },
    });
    const ids = candidatos
      .filter((c) => {
        const due = effectiveDue(c);
        return due != null && new Date(due).getTime() <= until.getTime();
      })
      .map((c) => c.id);
    if (ids.length === 0) return { updated: 0 };
    // La fecha de cobro real queda en su propia fecha prevista (no todas hoy).
    await prisma.$transaction(
      candidatos
        .filter((c) => ids.includes(c.id))
        .map((c) =>
          prisma.cheque.update({
            where: { id: c.id },
            data: { status: 'COBRADO', cashDate: effectiveDue(c) },
          }),
        ),
    );
    return { updated: ids.length };
  }

  static async create(input: ChequeInput, userId?: string) {
    return prisma.cheque.create({
      data: {
        issueDate: input.issueDate ?? null,
        dueDate: input.dueDate ?? null,
        number: input.number?.trim() ?? '',
        beneficiary: input.beneficiary?.trim() || null,
        bank: input.bank?.trim() || null,
        chequeraId: input.chequeraId ?? bankToChequeraId(input.bank),
        account: input.account?.trim() || null,
        amount: input.amount ?? 0,
        cashDate: input.cashDate ?? null,
        status: input.status ?? 'PENDIENTE',
        notes: input.notes?.trim() || null,
        groupId: input.groupId ?? null,
        installment: input.installment ?? null,
        createdBy: userId ?? null,
      },
      select: chequeSelect,
    });
  }

  static async update(id: string, input: ChequeInput) {
    const existing = await prisma.cheque.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Cheque no encontrado');
    return prisma.cheque.update({
      where: { id },
      data: {
        ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.number !== undefined ? { number: input.number.trim() } : {}),
        ...(input.beneficiary !== undefined ? { beneficiary: input.beneficiary?.trim() || null } : {}),
        ...(input.bank !== undefined ? { bank: input.bank?.trim() || null } : {}),
        ...(input.chequeraId !== undefined ? { chequeraId: input.chequeraId } : {}),
        ...(input.account !== undefined ? { account: input.account?.trim() || null } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.cashDate !== undefined ? { cashDate: input.cashDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      select: chequeSelect,
    });
  }

  // Marca un cheque como cobrado (con la fecha en que se cobró).
  static async markCashed(id: string, cashDate: Date, cashed = true) {
    const existing = await prisma.cheque.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Cheque no encontrado');
    return prisma.cheque.update({
      where: { id },
      data: cashed
        ? { status: 'COBRADO', cashDate }
        : { status: 'PENDIENTE', cashDate: null },
      select: chequeSelect,
    });
  }

  static async softDelete(id: string) {
    const existing = await prisma.cheque.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Cheque no encontrado');
    await prisma.cheque.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // --- Financiamientos de maquinaria (grupos de cheques mensuales) ---

  static async groupsOverview() {
    const groups = await prisma.chequeGroup.findMany({
      where: { deletedAt: null },
      include: {
        cheques: {
          where: { deletedAt: null },
          select: { amount: true, status: true, issueDate: true, dueDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const resumen = groups.map((g) => {
      const total = g.cheques.reduce((s, c) => s + c.amount, 0);
      const pagadas = g.cheques.filter((c) => c.status === 'COBRADO');
      const pendientes = g.cheques.filter((c) => c.status !== 'COBRADO' && c.status !== 'ANULADO');
      const montoPagado = pagadas.reduce((s, c) => s + c.amount, 0);
      const saldo = pendientes.reduce((s, c) => s + c.amount, 0);
      const nextDue = pendientes
        .map((c) => effectiveDue(c))
        .filter((d): d is Date => d != null)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
      return {
        id: g.id,
        name: g.name,
        source: g.source,
        notes: g.notes,
        total,
        cuotas: g.cheques.length,
        pagadas: pagadas.length,
        faltan: pendientes.length,
        montoPagado,
        saldo,
        nextDue,
      };
    });
    // Primero los activos (y entre ellos, el que se cobra antes); los ya
    // culminados quedan al final, que es como se muestran en la pantalla.
    return resumen.sort((a, b) => {
      const aVivo = a.faltan > 0;
      const bVivo = b.faltan > 0;
      if (aVivo !== bVivo) return aVivo ? -1 : 1;
      if (aVivo && bVivo) {
        const ta = a.nextDue ? new Date(a.nextDue).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.nextDue ? new Date(b.nextDue).getTime() : Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
      }
      return a.name.localeCompare(b.name);
    });
  }

  static async getGroup(id: string) {
    const g = await prisma.chequeGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        cheques: {
          where: { deletedAt: null },
          select: chequeSelect,
          orderBy: [{ installment: 'asc' }, { issueDate: 'asc' }],
        },
      },
    });
    if (!g) throw new NotFoundError('Financiamiento no encontrado');
    const total = g.cheques.reduce((s, c) => s + c.amount, 0);
    const montoPagado = g.cheques
      .filter((c) => c.status === 'COBRADO')
      .reduce((s, c) => s + c.amount, 0);
    return {
      id: g.id,
      name: g.name,
      source: g.source,
      notes: g.notes,
      notifyEmails: g.notifyEmails,
      notifyWeekly: g.notifyWeekly,
      notifyMonthly: g.notifyMonthly,
      notifyDayBefore: g.notifyDayBefore,
      notifyOnDue: g.notifyOnDue,
      cheques: g.cheques,
      total,
      montoPagado,
      saldo: total - montoPagado,
    };
  }

  // Crea un financiamiento y (opcional) genera N cuotas mensuales automáticas.
  static async createGroup(
    input: GroupNotifyInput & {
      name: string;
      source?: string | null;
      notes?: string | null;
      chequeraId?: string | null;
      // Lista explícita de cuotas: cada una con su nº de cheque, su fecha de
      // cobro y su monto (se pueden editar una por una antes de crear).
      cuotas?: { number?: string | null; dueDate: Date; amount: number }[] | null;
      generate?: {
        count: number;
        amount: number;
        firstDate: Date;
        firstNumber?: number | null;
      } | null;
    },
    userId?: string,
  ) {
    const group = await prisma.chequeGroup.create({
      data: {
        name: input.name.trim(),
        source: input.source?.trim() || null,
        notes: input.notes?.trim() || null,
        ...avisosData(input),
        createdBy: userId ?? null,
      },
    });
    // Cuotas explícitas: cada una con su número, fecha y monto.
    if (input.cuotas && input.cuotas.length > 0) {
      await prisma.cheque.createMany({
        data: input.cuotas.map((c, i) => ({
          issueDate: c.dueDate,
          dueDate: c.dueDate,
          number: (c.number ?? '').trim(),
          beneficiary: input.name.trim(),
          bank: input.source?.trim() || null,
          chequeraId: input.chequeraId ?? null,
          amount: c.amount,
          status: 'PENDIENTE',
          groupId: group.id,
          installment: i + 1,
          createdBy: userId ?? null,
        })),
      });
    } else if (input.generate && input.generate.count > 0) {
      const { count, amount, firstDate, firstNumber } = input.generate;
      const data = Array.from({ length: count }, (_, i) => {
        const dt = new Date(firstDate);
        dt.setMonth(dt.getMonth() + i);
        return {
          issueDate: dt,
          dueDate: dt,
          number: firstNumber != null ? String(firstNumber + i) : '',
          beneficiary: input.name.trim(),
          bank: input.source?.trim() || null,
          chequeraId: input.chequeraId ?? null,
          amount,
          status: 'PENDIENTE',
          groupId: group.id,
          installment: i + 1,
          createdBy: userId ?? null,
        };
      });
      await prisma.cheque.createMany({ data });
    }
    return this.getGroup(group.id);
  }

  static async updateGroup(id: string, input: GroupNotifyInput & { name?: string; source?: string | null; notes?: string | null }) {
    const g = await prisma.chequeGroup.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!g) throw new NotFoundError('Financiamiento no encontrado');
    await prisma.chequeGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.source !== undefined ? { source: input.source?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...avisosData(input),
      },
    });
    return this.getGroup(id);
  }

  static async deleteGroup(id: string) {
    const g = await prisma.chequeGroup.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!g) throw new NotFoundError('Financiamiento no encontrado');
    await prisma.$transaction([
      prisma.cheque.updateMany({ where: { groupId: id }, data: { deletedAt: new Date() } }),
      prisma.chequeGroup.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
  }

  // Importación masiva (migración del Excel). Idempotente por si se corre 2 veces:
  // no importa si ya hay cheques (se salta). Devuelve el conteo creado.
  static async bulkImport(
    payload: {
      registro?: ChequeInput[];
      groups?: {
        name: string;
        source?: string | null;
        cheques: ChequeInput[];
      }[];
      replace?: boolean;
    },
    userId?: string,
  ) {
    if (payload.replace) {
      // Migración: limpia todo antes de recargar (idempotente).
      await prisma.$transaction([
        prisma.cheque.updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } }),
        prisma.chequeGroup.updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } }),
      ]);
    } else {
      const existing = await prisma.cheque.count({ where: { deletedAt: null } });
      if (existing > 0) return { skipped: true, reason: 'Ya hay cheques cargados', existing };
    }

    let created = 0;
    if (payload.registro?.length) {
      await prisma.cheque.createMany({
        data: payload.registro.map((c) => ({
          issueDate: c.issueDate ?? null,
          dueDate: c.dueDate ?? null,
          number: c.number?.trim() ?? '',
          beneficiary: c.beneficiary || null,
          bank: c.bank || null,
          amount: c.amount ?? 0,
          cashDate: c.cashDate ?? null,
          status: c.status ?? 'PENDIENTE',
          notes: c.notes || null,
          createdBy: userId ?? null,
        })),
      });
      created += payload.registro.length;
    }
    for (const g of payload.groups ?? []) {
      const group = await prisma.chequeGroup.create({
        data: { name: g.name.trim(), source: g.source?.trim() || null, createdBy: userId ?? null },
      });
      if (g.cheques.length) {
        await prisma.cheque.createMany({
          data: g.cheques.map((c) => ({
            issueDate: c.issueDate ?? null,
            dueDate: c.dueDate ?? null,
            number: c.number?.trim() ?? '',
            beneficiary: c.beneficiary || null,
            bank: c.bank || g.source || null,
            amount: c.amount ?? 0,
            cashDate: c.cashDate ?? null,
            status: c.status ?? 'PENDIENTE',
            groupId: group.id,
            installment: c.installment ?? null,
            createdBy: userId ?? null,
          })),
        });
        created += g.cheques.length;
      }
    }
    return { skipped: false, created };
  }

  // --- Chequeras (cuentas) ---

  /** Crea las 7 chequeras si faltan y asigna la chequera a los cheques que no la tienen. */
  static async ensureChequeras() {
    for (const c of CHEQUERAS_SEED) {
      await prisma.chequera.upsert({
        where: { id: c.id },
        update: { corto: c.corto, empresa: c.empresa, banco: c.banco, orderIndex: c.orderIndex },
        create: { ...c },
      });
    }
    // Backfill: mapear el texto libre del banco a su chequera.
    const sinChequera = await prisma.cheque.findMany({
      where: { deletedAt: null, chequeraId: null },
      select: { id: true, bank: true },
    });
    let asignados = 0;
    for (const ch of sinChequera) {
      await prisma.cheque.update({
        where: { id: ch.id },
        data: { chequeraId: bankToChequeraId(ch.bank) },
      });
      asignados += 1;
    }
    return { chequeras: CHEQUERAS_SEED.length, asignados };
  }

  /** Chequeras con sus cifras: emitidos, pendiente y próximo folio. */
  static async chequeras() {
    const [libretas, cheques] = await Promise.all([
      prisma.chequera.findMany({ where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } }),
      prisma.cheque.findMany({
        where: { deletedAt: null },
        select: { chequeraId: true, amount: true, status: true, number: true },
      }),
    ]);
    return libretas.map((l) => {
      const propios = cheques.filter((c) => c.chequeraId === l.id);
      const activos = propios.filter((c) => c.status !== 'ANULADO');
      const pendiente = propios
        .filter((c) => c.status === 'PENDIENTE')
        .reduce((s, c) => s + c.amount, 0);
      const nums = propios
        .map((c) => Number(c.number))
        .filter((n) => Number.isFinite(n) && n > 0);
      return {
        id: l.id,
        corto: l.corto,
        empresa: l.empresa,
        banco: l.banco,
        emitidos: activos.length,
        emitidoMonto: activos.reduce((s, c) => s + c.amount, 0),
        pendiente,
        pendientesCount: propios.filter((c) => c.status === 'PENDIENTE').length,
        proximoFolio: nums.length ? Math.max(...nums) + 1 : null,
      };
    });
  }

  /** Resumen tipo dashboard: la foto del negocio en 5 segundos. */
  static async resumen() {
    const [cheques, grupos] = await Promise.all([
      prisma.cheque.findMany({
        where: { deletedAt: null },
        select: { ...chequeSelect, chequera: { select: { corto: true } } },
      }),
      this.groupsOverview(),
    ]);
    const hoy = startOfToday();
    const activos = cheques.filter((c) => c.status !== 'ANULADO');
    const pend = activos.filter((c) => c.status === 'PENDIENTE');
    const cob = activos.filter((c) => c.status === 'COBRADO');

    const conFecha = pend
      .map((c) => ({ c, due: effectiveDue(c) }))
      .filter((x): x is { c: (typeof pend)[number]; due: Date } => x.due != null)
      .map((x) => ({ ...x, dias: Math.round((new Date(x.due).getTime() - hoy) / 86_400_000) }))
      .sort((a, b) => a.dias - b.dias);

    interface FilaResumen {
      id: string;
      number: string;
      beneficiary: string | null;
      chequera: string | null;
      amount: number;
      dueDate: Date | null;
      dias: number | null;
    }
    const fila = (x: (typeof conFecha)[number]): FilaResumen => ({
      id: x.c.id,
      number: x.c.number,
      beneficiary: x.c.beneficiary,
      chequera: x.c.chequera?.corto ?? null,
      amount: x.c.amount,
      dueDate: x.due,
      dias: x.dias,
    });

    return {
      totalPendiente: pend.reduce((s, c) => s + c.amount, 0),
      countPendiente: pend.length,
      totalCobrado: cob.reduce((s, c) => s + c.amount, 0),
      countCobrado: cob.length,
      countTotal: activos.length,
      // Atención: vencidos (ya pasó la fecha) + los que se cobran en <= 3 días.
      atencion: conFecha.filter((x) => x.dias <= 3).slice(0, 6).map(fila),
      // Los próximos 3 cheques por cobrar, sin importar cuándo caigan. Si
      // sobran cupos, se completan con los pendientes que no tienen fecha.
      proximos3: ([
        // primero los que ya vencieron o caen hoy/adelante, en orden;
        // luego, si faltan, los pendientes sin fecha.
        ...conFecha.filter((x) => x.dias >= 0).map(fila),
        ...conFecha.filter((x) => x.dias < 0).map(fila),
        ...pend
          .filter((c) => effectiveDue(c) == null)
          .map(
            (c): FilaResumen => ({
              id: c.id,
              number: c.number,
              beneficiary: c.beneficiary,
              chequera: c.chequera?.corto ?? null,
              amount: c.amount,
              dueDate: null,
              dias: null,
            }),
          ),
      ] as FilaResumen[]).slice(0, 3),
      maquinaria: {
        saldo: grupos.reduce((s, g) => s + g.saldo, 0),
        cuotasRestantes: grupos.reduce((s, g) => s + g.faltan, 0),
        activas: grupos.filter((g) => g.faltan > 0).length,
        pagadas: grupos.filter((g) => g.faltan === 0).length,
      },
    };
  }

}
