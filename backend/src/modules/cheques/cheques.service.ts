import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

export const CHEQUE_STATUSES = ['COBRADO', 'PENDIENTE', 'VENCIDO', 'ANULADO'] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

const chequeSelect = {
  id: true,
  issueDate: true,
  number: true,
  beneficiary: true,
  bank: true,
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

interface ChequeInput {
  issueDate?: Date | null;
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
      .filter(
        (c) =>
          c.status === 'PENDIENTE' &&
          c.issueDate != null &&
          new Date(c.issueDate).getTime() <= limit,
      )
      .map((c) => {
        const t = new Date(c.issueDate as Date).getTime();
        const diffDays = Math.round((t - today) / 86_400_000);
        return {
          id: c.id,
          number: c.number,
          beneficiary: c.beneficiary,
          bank: c.bank,
          amount: c.amount,
          issueDate: c.issueDate,
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
  }) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filter.scope !== 'all') where.groupId = null;
    if (filter.status) where.status = filter.status;
    if (filter.bank) where.bank = filter.bank;
    if (filter.q) {
      where.OR = [
        { beneficiary: { contains: filter.q, mode: 'insensitive' } },
        { number: { contains: filter.q, mode: 'insensitive' } },
        { notes: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    return prisma.cheque.findMany({
      where,
      select: chequeSelect,
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async create(input: ChequeInput, userId?: string) {
    return prisma.cheque.create({
      data: {
        issueDate: input.issueDate ?? null,
        number: input.number?.trim() ?? '',
        beneficiary: input.beneficiary?.trim() || null,
        bank: input.bank?.trim() || null,
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
        ...(input.number !== undefined ? { number: input.number.trim() } : {}),
        ...(input.beneficiary !== undefined ? { beneficiary: input.beneficiary?.trim() || null } : {}),
        ...(input.bank !== undefined ? { bank: input.bank?.trim() || null } : {}),
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
          select: { amount: true, status: true, issueDate: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return groups.map((g) => {
      const total = g.cheques.reduce((s, c) => s + c.amount, 0);
      const pagadas = g.cheques.filter((c) => c.status === 'COBRADO');
      const pendientes = g.cheques.filter((c) => c.status !== 'COBRADO' && c.status !== 'ANULADO');
      const montoPagado = pagadas.reduce((s, c) => s + c.amount, 0);
      const saldo = pendientes.reduce((s, c) => s + c.amount, 0);
      const nextDue = pendientes
        .map((c) => c.issueDate)
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
      cheques: g.cheques,
      total,
      montoPagado,
      saldo: total - montoPagado,
    };
  }

  // Crea un financiamiento y (opcional) genera N cuotas mensuales automáticas.
  static async createGroup(
    input: {
      name: string;
      source?: string | null;
      notes?: string | null;
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
        createdBy: userId ?? null,
      },
    });
    if (input.generate && input.generate.count > 0) {
      const { count, amount, firstDate, firstNumber } = input.generate;
      const data = Array.from({ length: count }, (_, i) => {
        const dt = new Date(firstDate);
        dt.setMonth(dt.getMonth() + i);
        return {
          issueDate: dt,
          number: firstNumber != null ? String(firstNumber + i) : '',
          beneficiary: input.name.trim(),
          bank: input.source?.trim() || null,
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

  static async updateGroup(id: string, input: { name?: string; source?: string | null; notes?: string | null }) {
    const g = await prisma.chequeGroup.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!g) throw new NotFoundError('Financiamiento no encontrado');
    await prisma.chequeGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.source !== undefined ? { source: input.source?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
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
}
