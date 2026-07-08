import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envío de correo por SMTP. Se configura por variables de entorno:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Si no está configurado, `isMailConfigured()` es false y no se envía nada
 * (el sistema sigue funcionando; solo se salta el correo).
 */
let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 = SSL directo; 587 = STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export function mailFrom(): string {
  return (
    process.env.SMTP_FROM ||
    `CREACOM <${process.env.SMTP_USER || 'no-reply@creacomsa.com'}>`
  );
}

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/** Envía un correo. Devuelve {skipped:true} si no hay SMTP configurado. */
export async function sendMail(
  input: SendMailInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, skipped: true };
  try {
    await t.sendMail({
      from: mailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'error de envío' };
  }
}

/** Verifica la conexión/credenciales SMTP (para el endpoint de prueba). */
export async function verifyMail(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: 'SMTP no configurado' };
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'no se pudo verificar' };
  }
}
