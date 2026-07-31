import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import {
  IncidenciasService,
  INCIDENCIA_MODULES,
  INCIDENCIA_URGENCIES,
  INCIDENCIA_STATUSES,
} from './incidencias.service';

const imageFields = {
  imageBase64: z.string().min(10).nullish(),
  imageMime: z
    .string()
    .regex(/^image\//, 'Tipo de imagen no válido')
    .nullish(),
};

const listQuerySchema = z.object({
  status: z.enum(INCIDENCIA_STATUSES).optional(),
  urgency: z.enum(INCIDENCIA_URGENCIES).optional(),
  module: z.enum(INCIDENCIA_MODULES).optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  module: z.enum(INCIDENCIA_MODULES).default('OTRO'),
  urgency: z.enum(INCIDENCIA_URGENCIES).default('MEDIA'),
  ...imageFields,
});

const messageSchema = z.object({
  body: z.string().min(1).max(4000),
  // Responder como técnico (soporte) → marca la incidencia RESUELTA. Requiere
  // el permiso incidencias.manage.
  asTecnico: z.coerce.boolean().optional(),
  ...imageFields,
});

const statusSchema = z.object({ status: z.enum(INCIDENCIA_STATUSES) });

export const incidenciasRouter = Router();
incidenciasRouter.use(authenticate);

incidenciasRouter.get(
  '/',
  requirePermission(PERMISSIONS.INCIDENCIAS_READ),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await IncidenciasService.list(req.query as Record<string, string>);
    return success(res, data);
  }),
);

incidenciasRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.INCIDENCIAS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const incidencia = await IncidenciasService.getById(req.params.id);
    return success(res, incidencia);
  }),
);

incidenciasRouter.post(
  '/',
  requirePermission(PERMISSIONS.INCIDENCIAS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const incidencia = await IncidenciasService.create(req.body, req.user.id);
    return success(res, incidencia, 201);
  }),
);

// Agrega un mensaje al hilo. asTecnico=true (soporte) requiere manage.
incidenciasRouter.post(
  '/:id/messages',
  requirePermission(PERMISSIONS.INCIDENCIAS_WRITE),
  validate(idParamSchema, 'params'),
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const asTecnico = Boolean(req.body.asTecnico);
    if (asTecnico && !req.user.permissions.includes(PERMISSIONS.INCIDENCIAS_MANAGE)) {
      throw new UnauthorizedError('No puedes responder como técnico');
    }
    const incidencia = await IncidenciasService.addMessage(req.params.id, req.body, {
      asTecnico,
      authorId: req.user.id,
    });
    return success(res, incidencia);
  }),
);

incidenciasRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.INCIDENCIAS_WRITE),
  validate(idParamSchema, 'params'),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const incidencia = await IncidenciasService.setStatus(req.params.id, req.body.status);
    return success(res, incidencia);
  }),
);

// Sirve la imagen de una incidencia (token + permiso). itemType distingue la
// captura de la incidencia de la imagen de un mensaje del hilo.
incidenciasRouter.get(
  '/:id/image',
  requirePermission(PERMISSIONS.INCIDENCIAS_READ),
  asyncHandler(async (req, res) => {
    const inc = await prisma.incidencia.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { imageData: true, imageMime: true },
    });
    if (!inc || !inc.imageData || !inc.imageMime) throw new NotFoundError('Imagen no encontrada');
    res.setHeader('Content-Type', inc.imageMime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(inc.imageData));
  }),
);

incidenciasRouter.get(
  '/messages/:messageId/image',
  requirePermission(PERMISSIONS.INCIDENCIAS_READ),
  asyncHandler(async (req, res) => {
    const msg = await prisma.incidenciaMessage.findFirst({
      where: { id: req.params.messageId },
      select: { imageData: true, imageMime: true },
    });
    if (!msg || !msg.imageData || !msg.imageMime) throw new NotFoundError('Imagen no encontrada');
    res.setHeader('Content-Type', msg.imageMime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(msg.imageData));
  }),
);

incidenciasRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.INCIDENCIAS_MANAGE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await IncidenciasService.softDelete(req.params.id);
    return success(res, { message: 'Incidencia eliminada' });
  }),
);
