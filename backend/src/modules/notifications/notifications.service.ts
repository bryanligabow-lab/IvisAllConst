import { prisma } from '../../config/database';
import { IngresosService } from '../ingresos/ingresos.service';
import { sendMail } from '../../shared/email/mailer';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Elaborándose',
  SUBMITTED: 'Presentada',
  FISCALIZACION: 'En fiscalización',
  CONTRALORIA: 'En contraloría',
  APPROVED: 'Aprobada',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};
const FLOW = ['DRAFT', 'SUBMITTED', 'FISCALIZACION', 'CONTRALORIA', 'APPROVED', 'PAID'];
// Presentadas pero no pagadas: son las que un ingeniero debe ir moviendo.
const STUCK_STATUSES = ['SUBMITTED', 'FISCALIZACION', 'CONTRALORIA', 'APPROVED'];

function money(n: number): string {
  return '$' + n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function progressPct(status: string): number {
  if (status === 'CANCELLED') return 100;
  const i = FLOW.indexOf(status);
  return i < 0 ? 0 : Math.round(((i + 1) / FLOW.length) * 100);
}

const RED = '#C73E2C';

export class NotificationsService {
  static async activeRecipients(): Promise<string[]> {
    const rs = await prisma.notificationRecipient.findMany({
      where: { deletedAt: null, active: true, scope: 'PLANILLAS' },
      select: { email: true },
    });
    return rs.map((r) => r.email);
  }

  /** HTML del informe diario del estado de todas las planillas. */
  static async buildDailyReportHtml(dateLabel: string): Promise<{ html: string; subject: string }> {
    const data = await IngresosService.overview();
    const t = data.totals;

    // Filas de planillas (aplanadas), ordenadas por proyecto.
    const rows: string[] = [];
    for (const p of data.projects) {
      for (const pl of p.planillas) {
        const pct = progressPct(pl.status);
        rows.push(`
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">Planilla #${pl.number}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${p.name}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${STATUS_LABEL[pl.status] ?? pl.status}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${pct}%</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(pl.totalCurrent)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:${RED}">${money(pl.porCobrar)}</td>
          </tr>`);
      }
    }

    const kpi = (label: string, value: string, color = '#1A1A1A') =>
      `<td style="padding:10px 12px;background:#faf7f6;border-radius:8px">
         <div style="font-size:11px;color:#5c5c5c">${label}</div>
         <div style="font-size:18px;font-weight:700;color:${color}">${value}</div>
       </td>`;

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto">
      <h2 style="color:${RED};margin:0 0 4px">CREACOM — Estado de planillas</h2>
      <div style="font-size:12px;color:#5c5c5c;margin-bottom:16px">Informe del ${dateLabel}</div>
      <table style="border-spacing:8px;width:100%"><tr>
        ${kpi('Total planillado', money(t.planillado))}
        ${kpi('Facturado', money(t.facturado), '#2563EB')}
        ${kpi('Por cobrar', money(t.porCobrar), RED)}
        ${kpi('Ingresado', money(t.ingresado), '#1B7A52')}
      </tr></table>
      <div style="margin:14px 0;font-size:13px">
        <strong>${t.totalPlanillas}</strong> planillas ·
        ${t.presentadas} presentadas · ${t.aprobadas} aprobadas · ${t.pagadas} pagadas ·
        anticipos ${money(t.anticipos)}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:${RED};color:#fff">
            <th style="padding:6px 8px;text-align:left">Planilla</th>
            <th style="padding:6px 8px;text-align:left">Proyecto</th>
            <th style="padding:6px 8px;text-align:left">Estado</th>
            <th style="padding:6px 8px;text-align:right">Avance</th>
            <th style="padding:6px 8px;text-align:right">Planillado</th>
            <th style="padding:6px 8px;text-align:right">Por cobrar</th>
          </tr>
        </thead>
        <tbody>${rows.join('') || '<tr><td colspan="6" style="padding:10px">Sin planillas.</td></tr>'}</tbody>
      </table>
      <div style="margin-top:18px;font-size:11px;color:#9b9b9b">
        Este es un informe automático del sistema de gestión de CREACOM.
      </div>
    </div>`;

    const subject = `CREACOM · Estado de planillas — ${dateLabel} (por cobrar ${money(t.porCobrar)})`;
    return { html, subject };
  }

  /** Envía el informe diario a los correos activos. */
  static async sendDailyReport(): Promise<{ sent: boolean; recipients: number; error?: string }> {
    const recipients = await this.activeRecipients();
    if (recipients.length === 0) return { sent: false, recipients: 0 };
    const dateLabel = new Date().toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const { html, subject } = await this.buildDailyReportHtml(dateLabel);
    const r = await sendMail({ to: recipients, subject, html });
    return { sent: r.ok, recipients: recipients.length, error: r.error };
  }

  /**
   * Recordatorio a los residentes: planillas presentadas que llevan `days`
   * días sin cambiar de estado. Se agrupa por usuario asignado al proyecto.
   */
  static async sendStuckReminders(days = 5): Promise<{ emailsSent: number; stuck: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stuck = await prisma.planilla.findMany({
      where: {
        deletedAt: null,
        status: { in: STUCK_STATUSES },
        updatedAt: { lt: cutoff },
      },
      select: {
        number: true,
        status: true,
        updatedAt: true,
        project: {
          select: {
            name: true,
            assignments: {
              select: { user: { select: { email: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    if (stuck.length === 0) return { emailsSent: 0, stuck: 0 };

    // Agrupar por correo de residente asignado.
    const byUser = new Map<string, { name: string; items: string[] }>();
    for (const pl of stuck) {
      const line = `Planilla #${pl.number} — ${pl.project.name} (${STATUS_LABEL[pl.status] ?? pl.status})`;
      for (const a of pl.project.assignments) {
        const email = a.user.email;
        const entry = byUser.get(email) ?? { name: `${a.user.firstName} ${a.user.lastName}`, items: [] };
        entry.items.push(line);
        byUser.set(email, entry);
      }
    }

    let emailsSent = 0;
    for (const [email, { name, items }] of byUser) {
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
        <h3 style="color:${RED}">Recordatorio: actualiza el estado de tus planillas</h3>
        <p>Hola ${name}, estas planillas llevan más de ${days} días sin cambiar de estado.
        Por favor entra al sistema y actualiza en qué paso van (fiscalización, contraloría, aprobada, pagada):</p>
        <ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>
        <p style="font-size:12px;color:#5c5c5c">Sistema de gestión de CREACOM.</p>
      </div>`;
      const r = await sendMail({
        to: email,
        subject: `CREACOM · Recordatorio: ${items.length} planilla(s) por actualizar`,
        html,
      });
      if (r.ok) emailsSent += 1;
    }
    return { emailsSent, stuck: stuck.length };
  }
}
