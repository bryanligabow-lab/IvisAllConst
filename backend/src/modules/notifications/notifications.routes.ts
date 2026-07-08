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
import { isMailConfigured, verifyMail, sendMail } from '../../shared/email/mailer';

// Correos que reciben los informes de estado de las planillas.
const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
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
  asyncHandler(async (_req, res) => {
    const recipients = await prisma.notificationRecipient.findMany({
      where: { deletedAt: null, scope: 'PLANILLAS' },
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
        scope: 'PLANILLAS',
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
