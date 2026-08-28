import { prisma } from '../../config/database';
import { sendMail } from '../../shared/email/mailer';

/**
 * Avisos por correo de los cheques que hay que cubrir:
 *   - semanal: "esta semana tienes estos cheques por cubrir"
 *   - un día antes: "mañana se te cubre un cheque"
 *   - el mismo día: "hoy se te cobra un cheque"
 * Los destinatarios se administran en Cheques → Cuentas → Correos
 * (NotificationRecipient con scope 'CHEQUES').
 */

const SCOPE = 'CHEQUES';
const RED = '#C73E2C';
const TINTA = '#1a1a1a';
const GRIS = '#5c5c5c';

export type ChequeAvisoKind = 'SEMANA' | 'MES' | 'MANANA' | 'HOY';

function money(n: number): string {
  return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Las fechas se guardan al mediodía UTC: se leen en UTC para no correrlas un día. */
function fechaLarga(d: Date): string {
  return new Date(d).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
function fechaCorta(d: Date): string {
  return new Date(d).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Hoy en Ecuador (UTC-5), anclado al mediodía UTC igual que en la base. */
function hoyEcuador(): Date {
  const ec = new Date(Date.now() - 5 * 3_600_000);
  return new Date(Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate(), 12, 0, 0));
}
function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
/** Mismo día calendario (comparando en UTC). */
function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

interface ChequePendiente {
  id: string;
  number: string;
  beneficiary: string | null;
  amount: number;
  due: Date;
  chequera: string | null;
  grupoId: string | null;
  grupo: string | null;
  cuota: number | null;
}

export class ChequesNotifications {
  /** Correos activos que reciben los avisos de cheques. */
  static async recipients(): Promise<{ email: string; name: string | null }[]> {
    const rs = await prisma.notificationRecipient.findMany({
      where: { deletedAt: null, active: true, scope: SCOPE },
      select: { email: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    return rs;
  }

  /** Pendientes con fecha de cobro, ordenados del más próximo al más lejano. */
  private static async pendientes(): Promise<ChequePendiente[]> {
    const [cheques, chequeras] = await Promise.all([
      prisma.cheque.findMany({
        where: { deletedAt: null, status: 'PENDIENTE' },
        select: {
          id: true,
          number: true,
          beneficiary: true,
          amount: true,
          issueDate: true,
          dueDate: true,
          chequeraId: true,
          installment: true,
          groupId: true,
          group: { select: { name: true } },
        },
      }),
      prisma.chequera.findMany({ where: { deletedAt: null }, select: { id: true, corto: true } }),
    ]);
    const nombreChequera = new Map(chequeras.map((q) => [q.id, q.corto]));
    return cheques
      .map((c) => {
        const due = c.dueDate ?? c.issueDate;
        if (!due) return null;
        return {
          id: c.id,
          number: c.number,
          beneficiary: c.beneficiary,
          amount: c.amount,
          due,
          chequera: c.chequeraId ? (nombreChequera.get(c.chequeraId) ?? null) : null,
          grupoId: c.groupId,
          grupo: c.group?.name ?? null,
          cuota: c.installment,
        };
      })
      .filter((c): c is ChequePendiente => c !== null)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }

  /** Cheques de un día concreto (hoy, mañana…). */
  static async delDia(offsetDias: number): Promise<ChequePendiente[]> {
    const objetivo = sumarDias(hoyEcuador(), offsetDias);
    const todos = await this.pendientes();
    return todos.filter((c) => mismoDia(c.due, objetivo));
  }

  /** Cheques de los próximos 7 días + los atrasados que siguen pendientes. */
  static async deLaSemana(): Promise<{ semana: ChequePendiente[]; atrasados: ChequePendiente[] }> {
    const hoy = hoyEcuador();
    const fin = sumarDias(hoy, 6);
    const todos = await this.pendientes();
    return {
      semana: todos.filter((c) => c.due.getTime() >= hoy.getTime() && c.due.getTime() <= fin.getTime()),
      atrasados: todos.filter((c) => c.due.getTime() < hoy.getTime()),
    };
  }

  /** Cheques que se cobran de aquí al fin del mes en curso. */
  static async delMes(): Promise<ChequePendiente[]> {
    const hoy = hoyEcuador();
    const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0, 23, 59, 59));
    const todos = await this.pendientes();
    return todos.filter((c) => c.due.getTime() >= hoy.getTime() && c.due.getTime() <= fin.getTime());
  }

  /** Los cheques que le tocan a cada aviso, sin filtrar por destinatario. */
  private static async delAviso(kind: ChequeAvisoKind): Promise<ChequePendiente[]> {
    if (kind === 'SEMANA') return (await this.deLaSemana()).semana;
    if (kind === 'MES') return this.delMes();
    return this.delDia(kind === 'MANANA' ? 1 : 0);
  }

  // ---------- HTML ----------

  private static tabla(lista: ChequePendiente[]): string {
    const filas = lista
      .map(
        (c) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${fechaCorta(c.due)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${c.number ? '#' + c.number : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee">${c.beneficiary ?? 'Sin beneficiario'}${
            c.grupo ? `<div style="font-size:11px;color:${GRIS}">${c.grupo}${c.cuota ? ` · cuota ${c.cuota}` : ''}</div>` : ''
          }</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;color:${GRIS}">${c.chequera ?? '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${money(c.amount)}</td>
        </tr>`,
      )
      .join('');
    const total = lista.reduce((s, c) => s + c.amount, 0);
    return `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead>
          <tr style="background:${RED};color:#fff;text-align:left">
            <th style="padding:8px 10px">Fecha</th>
            <th style="padding:8px 10px">Cheque</th>
            <th style="padding:8px 10px">Beneficiario</th>
            <th style="padding:8px 10px">Chequera</th>
            <th style="padding:8px 10px;text-align:right">Monto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px;text-align:right;font-weight:700">TOTAL</td>
            <td style="padding:10px;text-align:right;font-weight:700;color:${RED}">${money(total)}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  private static envoltura(saludo: string, cuerpo: string): string {
    return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:${TINTA};max-width:720px;margin:0 auto">
      <h2 style="color:${RED};margin:0 0 4px">CREACOM — Control de cheques</h2>
      <p style="font-size:14px;margin:16px 0 6px">${saludo}</p>
      ${cuerpo}
      <p style="font-size:11px;color:${GRIS};margin-top:22px">
        Este aviso lo envía el sistema CREACOM automáticamente. Si un cheque ya se cobró,
        márcalo en la aplicación para que deje de aparecer.
      </p>
    </div>`;
  }

  /**
   * Arma asunto + HTML del aviso con la lista de cheques que le toca ver a esa
   * persona. Devuelve null cuando no hay nada que avisar (salvo el semanal, que
   * se manda igual diciendo que la semana está limpia).
   */
  static build(
    kind: ChequeAvisoKind,
    lista: ChequePendiente[],
    nombre?: string | null,
    atrasados: ChequePendiente[] = [],
  ): { subject: string; html: string } | null {
    const saludo = nombre ? `Estimado/a ${nombre}:` : 'Estimados:';
    const total = lista.reduce((s, c) => s + c.amount, 0);
    const n = lista.length;
    const cuantos = n === 1 ? 'un cheque' : `${n} cheques`;

    if (kind === 'SEMANA' || kind === 'MES') {
      const periodo = kind === 'SEMANA' ? 'esta semana' : 'este mes';
      const cuerpo =
        n === 0
          ? `<p style="font-size:14px">${
              periodo[0].toUpperCase() + periodo.slice(1)
            } <strong>no hay cheques programados</strong> para cobro.</p>`
          : `<p style="font-size:14px">${
              periodo[0].toUpperCase() + periodo.slice(1)
            } tienes <strong>${n}</strong> ${
              n === 1 ? 'cheque' : 'cheques'
            } por cubrir, por un total de <strong style="color:${RED}">${money(total)}</strong>:</p>
             ${this.tabla(lista)}`;
      const extra =
        atrasados.length > 0
          ? `<p style="font-size:14px;margin-top:22px">Además siguen <strong>pendientes de cobro</strong> ${
              atrasados.length
            } ${atrasados.length === 1 ? 'cheque con fecha pasada' : 'cheques con fecha pasada'}:</p>
             ${this.tabla(atrasados.slice(0, 30))}`
          : '';
      return {
        subject:
          n === 0
            ? `CREACOM · Sin cheques por cubrir ${periodo}`
            : `CREACOM · Cheques por cubrir ${periodo} (${money(total)})`,
        html: this.envoltura(saludo, cuerpo + extra),
      };
    }

    if (n === 0) return null;
    const dia = fechaLarga(sumarDias(hoyEcuador(), kind === 'MANANA' ? 1 : 0));
    const frase =
      kind === 'MANANA'
        ? `Te recordamos que <strong>mañana (${dia})</strong> se cubre${n === 1 ? '' : 'n'} ${cuantos} por <strong style="color:${RED}">${money(total)}</strong>.`
        : `<strong>Hoy (${dia})</strong> se cobra${n === 1 ? '' : 'n'} ${cuantos} por <strong style="color:${RED}">${money(total)}</strong>.`;
    return {
      subject:
        kind === 'MANANA'
          ? `CREACOM · Mañana se cubre${n === 1 ? '' : 'n'} ${cuantos} (${money(total)})`
          : `CREACOM · Hoy se cobra${n === 1 ? '' : 'n'} ${cuantos} (${money(total)})`,
      html: this.envoltura(saludo, `<p style="font-size:14px">${frase}</p>${this.tabla(lista)}`),
    };
  }

  /**
   * Junta a quién hay que escribirle y qué cheques le tocan:
   *   - la lista general (Cuentas → Correos) ve TODOS los cheques del aviso;
   *   - cada financiamiento tiene su propia lista de correos y sus avisos
   *     activados, y esos solo ven los cheques de ese financiamiento.
   * Si un correo está en las dos, recibe un único email con todo junto.
   */
  private static async destinatarios(
    kind: ChequeAvisoKind,
    cheques: ChequePendiente[],
  ): Promise<Map<string, { name: string | null; cheques: ChequePendiente[] }>> {
    const mapa = new Map<string, { name: string | null; cheques: ChequePendiente[] }>();
    const agregar = (email: string, name: string | null, lista: ChequePendiente[]) => {
      const key = email.trim().toLowerCase();
      if (!key) return;
      const actual = mapa.get(key);
      if (!actual) {
        mapa.set(key, { name, cheques: [...lista] });
        return;
      }
      const vistos = new Set(actual.cheques.map((c) => c.id));
      for (const c of lista) if (!vistos.has(c.id)) actual.cheques.push(c);
      if (!actual.name && name) actual.name = name;
    };

    // El aviso mensual es solo de financiamientos (la lista general no lo tiene).
    if (kind !== 'MES') {
      for (const g of await this.recipients()) agregar(g.email, g.name, cheques);
    }

    const campo =
      kind === 'SEMANA'
        ? 'notifyWeekly'
        : kind === 'MES'
          ? 'notifyMonthly'
          : kind === 'MANANA'
            ? 'notifyDayBefore'
            : 'notifyOnDue';
    const grupos = await prisma.chequeGroup.findMany({
      where: { deletedAt: null, [campo]: true },
      select: { id: true, notifyEmails: true },
    });
    for (const g of grupos) {
      const suyos = cheques.filter((c) => c.grupoId === g.id);
      if (suyos.length === 0 && kind !== 'SEMANA' && kind !== 'MES') continue;
      for (const email of g.notifyEmails) agregar(email, null, suyos);
    }

    for (const d of mapa.values()) d.cheques.sort((a, b) => a.due.getTime() - b.due.getTime());
    return mapa;
  }

  /**
   * Envía el aviso: un correo por persona, con lo que a esa persona le toca.
   * Si no hay nada que avisar, no manda nada.
   */
  static async enviar(
    kind: ChequeAvisoKind,
  ): Promise<{ sent: number; recipients: number; skipped?: boolean; error?: string }> {
    const cheques = await this.delAviso(kind);
    const atrasados = kind === 'SEMANA' ? (await this.deLaSemana()).atrasados : [];
    const destinos = await this.destinatarios(kind, cheques);
    if (destinos.size === 0) return { sent: 0, recipients: 0, error: 'No hay correos activos' };

    let sent = 0;
    let error: string | undefined;
    for (const [email, d] of destinos) {
      const armado = this.build(kind, d.cheques, d.name?.split(' ')[0] ?? null, atrasados);
      if (!armado) continue; // ese día no le toca nada
      const r = await sendMail({ to: email, subject: armado.subject, html: armado.html });
      if (r.ok) sent += 1;
      else if (r.skipped) return { sent, recipients: destinos.size, skipped: true };
      else if (r.error) error = r.error;
    }
    return { sent, recipients: destinos.size, error };
  }

  /** Vista previa (o prueba a un solo correo) con TODOS los cheques del aviso. */
  static async preview(
    kind: ChequeAvisoKind,
    nombre?: string | null,
  ): Promise<{ subject: string; html: string } | null> {
    const cheques = await this.delAviso(kind);
    const atrasados = kind === 'SEMANA' ? (await this.deLaSemana()).atrasados : [];
    return this.build(kind, cheques, nombre ?? null, atrasados);
  }
}
