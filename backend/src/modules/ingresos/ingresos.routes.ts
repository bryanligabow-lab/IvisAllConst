import { Router } from 'express';
import { z } from 'zod';
import { IngresosService, INGRESO_KINDS } from './ingresos.service';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { loadProjectScope, requireProjectAccess } from '../../middleware/projectScope';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { SUCCESS } from '../../shared/constants/error-messages';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';

const createIngresoSchema = z.object({
  projectId: z.string().uuid(),
  planillaId: z.string().uuid().optional().nullable(),
  kind: z.enum(INGRESO_KINDS).default('PLANILLA'),
  amount: z.coerce.number().positive(),
  ingresoDate: calendarDateSchema,
  entity: z.string().max(200).optional(),
  invoiceNumber: z.string().max(80).optional(),
  reference: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  // Documento adjunto (PDF/foto de la planilla o comprobante). base64 sin prefijo.
  documentBase64: z.string().optional().nullable(),
  documentMime: z.string().max(120).optional().nullable(),
  documentName: z.string().max(200).optional().nullable(),
});

const updateIngresoSchema = createIngresoSchema.partial().omit({ projectId: true });

const listQuerySchema = z.object({ projectId: z.string().uuid() });

export const ingresosRouter = Router();
ingresosRouter.use(authenticate);
ingresosRouter.use(loadProjectScope);

ingresosRouter.get(
  '/',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const items = await IngresosService.list(req.query.projectId as string);
    return success(res, items);
  }),
);

// Resumen de cobro del proyecto (anticipo, devengado, planillas, facturado,
// ingresado, por cobrar). Alimenta las tarjetas de la pestaña Ingresos.
ingresosRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const summary = await IngresosService.summary(req.query.projectId as string);
    return success(res, summary);
  }),
);

// Sirve el documento adjunto (PDF/foto) de un ingreso.
ingresosRouter.get(
  '/:id/document',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const doc = await IngresosService.getDocument(req.params.id);
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(doc.projectId)) {
      throw new UnauthorizedError('No tienes acceso a este proyecto');
    }
    res.setHeader('Content-Type', doc.documentMime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (doc.documentName) {
      res.setHeader('Content-Disposition', `inline; filename="${doc.documentName.replace(/"/g, '')}"`);
    }
    res.send(Buffer.from(doc.documentData as Buffer));
  }),
);

// Vista consolidada de todos los proyectos (apartado "Planillas"): KPIs
// globales + por proyecto sus planillas con estado y su resumen de cobro.
ingresosRouter.get(
  '/overview',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  asyncHandler(async (req, res) => {
    const data = await IngresosService.overview(req.allowedProjectIds ?? undefined);
    return success(res, data);
  }),
);

// Facturas cobradas (conciliación) de un proyecto.
ingresosRouter.get(
  '/facturas',
  requirePermission(PERMISSIONS.INGRESOS_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const items = await IngresosService.facturas(req.query.projectId as string);
    return success(res, items);
  }),
);

const createFacturaSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().min(1).max(60),
  invoiceDate: calendarDateSchema.optional().nullable(),
  total: z.coerce.number().optional(),
  advanceAmortized: z.coerce.number().optional(),
  guaranteeRetained: z.coerce.number().optional(),
  ivaRetention: z.coerce.number().optional(),
  fuenteRetention: z.coerce.number().optional(),
  entity: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});
ingresosRouter.post(
  '/facturas',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(createFacturaSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const created = await IngresosService.createFactura(req.body, req.user.id);
    return success(res, created, 201);
  }),
);

ingresosRouter.post(
  '/',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(createIngresoSchema),
  requireProjectAccess((req) => req.body.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const ingreso = await IngresosService.create(req.body, req.user.id);
    return success(res, ingreso, 201);
  }),
);

ingresosRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateIngresoSchema),
  asyncHandler(async (req, res) => {
    const existing = await IngresosService.getById(req.params.id);
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(existing.projectId)) {
      throw new UnauthorizedError('No tienes acceso a este proyecto');
    }
    const ingreso = await IngresosService.update(req.params.id, req.body);
    return success(res, ingreso);
  }),
);

ingresosRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.INGRESOS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const existing = await IngresosService.getById(req.params.id);
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(existing.projectId)) {
      throw new UnauthorizedError('No tienes acceso a este proyecto');
    }
    await IngresosService.softDelete(req.params.id);
    return success(res, { message: SUCCESS.INGRESO_DELETED });
  }),
);
