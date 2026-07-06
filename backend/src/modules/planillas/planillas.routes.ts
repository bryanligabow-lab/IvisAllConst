import { Router } from 'express';
import { z } from 'zod';
import { PlanillasService, PLANILLA_STATUSES } from './planillas.service';
import { exportPlanillaExcel } from './planillas.excel';
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

const planillaItemSchema = z.object({
  rubroId: z.string().uuid(),
  executedQuantity: z.coerce.number().nonnegative().default(0),
  currentAmount: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

const createPlanillaSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  periodStart: calendarDateSchema,
  periodEnd: calendarDateSchema,
  items: z.array(planillaItemSchema).min(1),
});

const statusSchema = z.object({
  status: z.enum(PLANILLA_STATUSES),
  // Nota opcional del residente ("ingresó a contraloría", "devuelta por observaciones"…).
  note: z.string().max(500).optional(),
});

const listQuerySchema = z.object({ projectId: z.string().uuid() });

export const planillasRouter = Router();
planillasRouter.use(authenticate);
planillasRouter.use(loadProjectScope);

planillasRouter.get(
  '/',
  requirePermission(PERMISSIONS.PLANILLAS_READ),
  validate(listQuerySchema, 'query'),
  requireProjectAccess((req) => req.query.projectId as string | undefined),
  asyncHandler(async (req, res) => {
    const items = await PlanillasService.list(req.query.projectId as string);
    return success(res, items);
  }),
);

planillasRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PLANILLAS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const planilla = await PlanillasService.getById(req.params.id);
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(planilla.projectId)) {
      throw new UnauthorizedError('No tienes acceso a este proyecto');
    }
    return success(res, planilla);
  }),
);

planillasRouter.post(
  '/',
  requirePermission(PERMISSIONS.PLANILLAS_WRITE),
  validate(createPlanillaSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const planilla = await PlanillasService.create(req.body, req.user.id);
    return success(res, planilla, 201);
  }),
);

planillasRouter.patch(
  '/:id/status',
  // El operador (residente) también puede mover el estado desde obra.
  requirePermission(PERMISSIONS.PLANILLAS_STATUS),
  validate(idParamSchema, 'params'),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const existing = await PlanillasService.getById(req.params.id);
    if (req.allowedProjectIds && !req.allowedProjectIds.includes(existing.projectId)) {
      throw new UnauthorizedError('No tienes acceso a este proyecto');
    }
    const planilla = await PlanillasService.updateStatus(
      req.params.id,
      req.body.status,
      req.user.id,
      req.body.note,
    );
    return success(res, planilla);
  }),
);

planillasRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PLANILLAS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await PlanillasService.softDelete(req.params.id);
    return success(res, { message: SUCCESS.PLANILLA_DELETED });
  }),
);

planillasRouter.get(
  '/:id/export',
  requirePermission(PERMISSIONS.PLANILLAS_EXPORT),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await exportPlanillaExcel(req.params.id, res);
  }),
);
