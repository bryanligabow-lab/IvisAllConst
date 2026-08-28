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

  /**
   * Papelería común de todos los correos: membrete, título, cuerpo, despedida y
   * pie. Se mantiene el mismo formato en los cuatro avisos para que la
   * comunicación se vea de la empresa y no de un script.
   */
  private static envoltura(titulo: string, saludo: string, cuerpo: string): string {
    return `
    <div style="background:#f5f3f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e1dc">
        <div style="background:${RED};padding:18px 24px">
          <div style="color:#ffffff;font-size:19px;font-weight:bold;letter-spacing:.04em">CREACOM S.A.</div>
          <div style="color:#ffffff;opacity:.85;font-size:11px;letter-spacing:.12em;text-transform:uppercase">
            Innovación · Proyectos · Servicios
          </div>
        </div>
        <div style="padding:24px">
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${GRIS}">
            Control de cheques
          </div>
          <h1 style="font-size:20px;color:${TINTA};margin:4px 0 18px">${titulo}</h1>
          <p style="font-size:14px;color:${TINTA};margin:0 0 12px">${saludo}</p>
          ${cuerpo}
          <p style="font-size:14px;color:${TINTA};margin:22px 0 0">
            Quedamos atentos a cualquier consulta.
          </p>
          <p style="font-size:14px;color:${TINTA};margin:14px 0 0">
            Atentamente,<br />
            <strong>Departamento de Administración y Finanzas</strong><br />
            CREACOM S.A.
          </p>
        </div>
        <div style="border-top:1px solid #e5e1dc;padding:14px 24px;background:#faf8f7">
          <p style="font-size:11px;color:${GRIS};margin:0">
            Mensaje generado automáticamente por el sistema de control de cheques de CREACOM S.A.
            Si algún cheque ya fue cobrado, le agradecemos actualizar su estado en el sistema para
            mantener la información al día. Por favor no responda a este correo.
          </p>
        </div>
      </div>
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
    const saludo = nombre ? `Estimado/a ${nombre}:` : 'Estimados señores:';
    const total = lista.reduce((s, c) => s + c.amount, 0);
    const n = lista.length;
    const cuantos = n === 1 ? 'un (1) cheque' : `${n} cheques`;
    const p = (t: string) => `<p style="font-size:14px;color:${TINTA};margin:0 0 10px">${t}</p>`;

    if (kind === 'SEMANA' || kind === 'MES') {
      const periodo = kind === 'SEMANA' ? 'la presente semana' : 'el presente mes';
      const titulo =
        kind === 'SEMANA' ? 'Cheques programados para la semana' : 'Cheques programados para el mes';
      const cuerpo =
        n === 0
          ? p(
              `Por medio del presente le informamos que para ${periodo} <strong>no existen cheques programados</strong> para cobro.`,
            )
          : p(
              `Por medio del presente le informamos que para ${periodo} se encuentran programados <strong>${cuantos}</strong>, por un valor total de <strong style="color:${RED}">${money(total)}</strong>. A continuación el detalle:`,
            ) + this.tabla(lista);
      const extra =
        atrasados.length > 0
          ? `<div style="margin-top:22px">${p(
              `Adicionalmente, ${
                atrasados.length === 1
                  ? 'permanece pendiente de cobro un (1) cheque con fecha anterior a la actual'
                  : `permanecen pendientes de cobro ${atrasados.length} cheques con fecha anterior a la actual`
              }:`,
            )}${this.tabla(atrasados.slice(0, 30))}</div>`
          : '';
      return {
        subject:
          n === 0
            ? `CREACOM S.A. · Sin cheques programados para ${kind === 'SEMANA' ? 'la semana' : 'el mes'}`
            : `CREACOM S.A. · Cheques programados para ${kind === 'SEMANA' ? 'la semana' : 'el mes'} — ${money(total)}`,
        html: this.envoltura(titulo, saludo, cuerpo + extra),
      };
    }

    if (n === 0) return null;
    const dia = fechaLarga(sumarDias(hoyEcuador(), kind === 'MANANA' ? 1 : 0));
    const frase =
      kind === 'MANANA'
        ? `Por medio del presente le recordamos que <strong>mañana ${dia}</strong> se hará efectivo el cobro de <strong>${cuantos}</strong>, por un valor total de <strong style="color:${RED}">${money(total)}</strong>. Le agradecemos mantener la provisión de fondos correspondiente.`
        : `Por medio del presente le informamos que <strong>hoy ${dia}</strong> se hace efectivo el cobro de <strong>${cuantos}</strong>, por un valor total de <strong style="color:${RED}">${money(total)}</strong>.`;
    return {
      subject:
        kind === 'MANANA'
          ? `CREACOM S.A. · Recordatorio: cobro de cheques mañana — ${money(total)}`
          : `CREACOM S.A. · Cheques con cobro el día de hoy — ${money(total)}`,
      html: this.envoltura(
        kind === 'MANANA' ? 'Recordatorio de cobro para mañana' : 'Cheques con cobro el día de hoy',
        saludo,
        p(frase) + this.tabla(lista),
      ),
    };
  }

  // ---------- Aviso de emisión (al cargar un cheque) ----------

  /**
   * Avisa que se emitió un cheque: de qué chequera salió, por cuánto y con qué
   * detalle. Se dispara al registrar un cheque en el sistema.
   */
  private static async armarEmision(
    chequeId: string,
    userId?: string | null,
  ): Promise<{
    subject: string;
    cuerpo: string;
    emails: Map<string, string | null>;
  } | null> {
    const c = await prisma.cheque.findFirst({
      where: { id: chequeId, deletedAt: null },
      select: {
        number: true,
        beneficiary: true,
        amount: true,
        issueDate: true,
        dueDate: true,
        notes: true,
        chequeraId: true,
        installment: true,
        groupId: true,
        group: { select: { name: true, notifyEmails: true } },
      },
    });
    if (!c) return null;

    const [chequera, autor] = await Promise.all([
      c.chequeraId
        ? prisma.chequera.findFirst({
            where: { id: c.chequeraId },
            select: { corto: true, empresa: true, banco: true },
          })
        : null,
      userId
        ? prisma.user.findFirst({
            where: { id: userId },
            select: { firstName: true, lastName: true, email: true },
          })
        : null,
    ]);
    const registradoPor = autor
      ? [autor.firstName, autor.lastName].filter(Boolean).join(' ') || autor.email
      : null;
    const nombreChequera = chequera
      ? `${chequera.corto} (${chequera.empresa} — ${chequera.banco})`
      : 'Sin chequera asignada';

    const filas: [string, string][] = [
      ['Chequera', nombreChequera],
      ['Número de cheque', c.number ? `#${c.number}` : 'Sin número'],
      ['Beneficiario', c.beneficiary ?? 'Sin beneficiario registrado'],
      ['Valor', money(c.amount)],
      ['Fecha de emisión', c.issueDate ? fechaCorta(c.issueDate) : 'No registrada'],
      ['Fecha prevista de cobro', c.dueDate ? fechaCorta(c.dueDate) : 'No registrada'],
    ];
    if (c.group?.name) {
      filas.push([
        'Financiamiento',
        `${c.group.name}${c.installment ? ` — cuota ${c.installment}` : ''}`,
      ]);
    }
    filas.push(['Detalle', c.notes?.trim() || 'Sin detalle adicional']);
    if (registradoPor) filas.push(['Registrado por', registradoPor]);

    const detalle = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:4px 0 0">
        ${filas
          .map(
            ([k, v], i) => `
          <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #eee;background:#faf8f7;width:200px;color:${GRIS};vertical-align:top">${k}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #eee;${
              i === 3 ? `font-weight:bold;color:${RED};font-size:15px` : ''
            }">${v}</td>
          </tr>`,
          )
          .join('')}
      </table>`;

    // A la lista general de cheques y, si el cheque pertenece a un
    // financiamiento, también a los correos de ese financiamiento.
    const emails = new Map<string, string | null>();
    for (const r of await this.recipients()) emails.set(r.email.toLowerCase(), r.name);
    for (const e of c.group?.notifyEmails ?? []) {
      const key = e.trim().toLowerCase();
      if (key && !emails.has(key)) emails.set(key, null);
    }
    return {
      subject: `CREACOM S.A. · Emisión de cheque ${c.number ? `#${c.number} ` : ''}— ${money(c.amount)}`,
      cuerpo: `<p style="font-size:14px;color:${TINTA};margin:0 0 12px">
           Por medio del presente le informamos que se ha registrado la emisión de un cheque
           con cargo a la chequera <strong>${nombreChequera}</strong>, por un valor de
           <strong style="color:${RED}">${money(c.amount)}</strong>. A continuación el detalle:
         </p>${detalle}`,
      emails,
    };
  }

  /** Manda el aviso de emisión a quien corresponda. */
  static async avisoEmision(
    chequeId: string,
    userId?: string | null,
  ): Promise<{ sent: number; recipients: number; skipped?: boolean; error?: string }> {
    const armado = await this.armarEmision(chequeId, userId);
    if (!armado) return { sent: 0, recipients: 0, error: 'Cheque no encontrado' };
    if (armado.emails.size === 0) return { sent: 0, recipients: 0, error: 'No hay correos activos' };

    let sent = 0;
    let error: string | undefined;
    for (const [email, name] of armado.emails) {
      const saludo = name ? `Estimado/a ${name.split(' ')[0]}:` : 'Estimados señores:';
      const html = this.envoltura('Emisión de cheque', saludo, armado.cuerpo);
      const r = await sendMail({ to: email, subject: armado.subject, html });
      if (r.ok) sent += 1;
      else if (r.skipped) return { sent, recipients: armado.emails.size, skipped: true };
      else if (r.error) error = r.error;
    }
    return { sent, recipients: armado.emails.size, error };
  }

  /** Vista previa del aviso de emisión (no envía nada). */
  static async previewEmision(
    chequeId: string,
  ): Promise<{ subject: string; html: string } | null> {
    const armado = await this.armarEmision(chequeId);
    if (!armado) return null;
    return {
      subject: armado.subject,
      html: this.envoltura('Emisión de cheque', 'Estimado/a Gabriel:', armado.cuerpo),
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
