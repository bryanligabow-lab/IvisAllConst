import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { NotificationsService } from './notifications.service';
import { ChequesNotifications, type ChequeAvisoKind } from '../cheques/cheques.notifications';
import { isMailConfigured, verifyMail, sendMail } from '../../shared/email/mailer';

// Correos que reciben los informes. Hay dos listas separadas: la de planillas
// (informe diario de estados) y la de cheques (avisos de cobro).
const SCOPES = ['PLANILLAS', 'CHEQUES'] as const;
function scopeOf(value: unknown): string {
  return SCOPES.includes(String(value) as (typeof SCOPES)[number]) ? String(value) : 'PLANILLAS';
}

const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  scope: z.enum(SCOPES).optional(),
});
const updateSchema = z.object({
  email: z.string().email().max(200).optional(),
  name: z.string().max(120).optional().nullable(),
  active: z.boolean().optional(),
});

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/recipients',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  asyncHandler(async (req, res) => {
    const recipients = await prisma.notificationRecipient.findMany({
      where: { deletedAt: null, scope: scopeOf(req.query.scope) },
      orderBy: { createdAt: 'asc' },
    });
    return success(res, recipients);
  }),
);

notificationsRouter.post(
  '/recipients',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await prisma.notificationRecipient.create({
      data: {
        email: req.body.email.trim().toLowerCase(),
        name: req.body.name?.trim() || null,
        scope: scopeOf(req.body.scope),
        createdBy: req.user.id,
      },
    });
    return success(res, created, 201);
  }),
);

notificationsRouter.patch(
  '/recipients/:id',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.notificationRecipient.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Correo no encontrado');
    const updated = await prisma.notificationRecipient.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.email !== undefined ? { email: req.body.email.trim().toLowerCase() } : {}),
        ...(req.body.name !== undefined ? { name: req.body.name?.trim() || null } : {}),
        ...(req.body.active !== undefined ? { active: req.body.active } : {}),
      },
    });
    return success(res, updated);
  }),
);

// Estado de la configuración de correo (¿ya está el SMTP puesto?).
notificationsRouter.get(
  '/mail-status',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  asyncHandler(async (_req, res) => {
    return success(res, { configured: isMailConfigured() });
  }),
);

// Verifica credenciales SMTP (para saber si el correo emisor quedó bien puesto).
notificationsRouter.post(
  '/verify',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  asyncHandler(async (_req, res) => {
    const r = await verifyMail();
    return success(res, r);
  }),
);

// Envía el informe de planillas AHORA. Si viene { email }, lo manda solo a ese
// correo (prueba); si no, a todos los correos activos.
const testSchema = z.object({ email: z.string().email().optional() });
notificationsRouter.post(
  '/send-report',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(testSchema),
  asyncHandler(async (req, res) => {
    if (req.body.email) {
      const dateLabel = new Date().toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const { html, subject } = await NotificationsService.buildDailyReportHtml(dateLabel);
      const r = await sendMail({ to: req.body.email, subject, html });
      return success(res, { ...r, to: req.body.email });
    }
    const r = await NotificationsService.sendDailyReport();
    return success(res, r);
  }),
);

// Vista previa del aviso (sin enviar nada): para revisar cómo se ve el correo.
notificationsRouter.get(
  '/cheques/preview',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (req, res) => {
    const kind = (['SEMANA', 'MES', 'MANANA', 'HOY'].includes(String(req.query.kind))
      ? String(req.query.kind)
      : 'SEMANA') as ChequeAvisoKind;
    const armado = await ChequesNotifications.preview(kind, 'Gabriel');
    if (!armado) return success(res, { empty: true, kind });
    return success(res, { kind, ...armado });
  }),
);

// Avisos de cheques: manda AHORA el resumen semanal (o el de mañana/hoy).
// Con { email } va solo a ese correo, como prueba.
const chequeAvisoSchema = z.object({
  kind: z.enum(['SEMANA', 'MES', 'MANANA', 'HOY']).optional(),
  email: z.string().email().optional(),
});
notificationsRouter.post(
  '/cheques/send',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(chequeAvisoSchema),
  asyncHandler(async (req, res) => {
    const kind = (req.body.kind ?? 'SEMANA') as ChequeAvisoKind;
    if (req.body.email) {
      const armado = await ChequesNotifications.preview(kind);
      if (!armado) return success(res, { sent: 0, empty: true });
      const r = await sendMail({ to: req.body.email, subject: armado.subject, html: armado.html });
      return success(res, { ...r, sent: r.ok ? 1 : 0, to: req.body.email });
    }
    return success(res, await ChequesNotifications.enviar(kind));
  }),
);

notificationsRouter.delete(
  '/recipients/:id',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const exists = await prisma.notificationRecipient.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Correo no encontrado');
    await prisma.notificationRecipient.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Correo eliminado' });
  }),
);
