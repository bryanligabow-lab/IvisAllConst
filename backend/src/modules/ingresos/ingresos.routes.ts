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
