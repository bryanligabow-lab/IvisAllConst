import { Router } from 'express';
import { z } from 'zod';
import { PlanillasService } from './planillas.service';
import { exportPlanillaExcel } from './planillas.excel';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { UnauthorizedError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { SUCCESS } from '../../shared/constants/error-messages';
import { idParamSchema } from '../../shared/dto/id-param.dto';

const planillaItemSchema = z.object({
  rubroId: z.string().uuid(),
  executedQuantity: z.coerce.number().nonnegative().default(0),
  currentAmount: z.coerce.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

const createPlanillaSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  items: z.array(planillaItemSchema).min(1),
});

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'CANCELLED']),
});

const listQuerySchema = z.object({ projectId: z.string().uuid() });

export const planillasRouter = Router();
planillasRouter.use(authenticate);

planillasRouter.get(
  '/',
  requirePermission(PERMISSIONS.PLANILLAS_READ),
  validate(listQuerySchema, 'query'),
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
  requirePermission(PERMISSIONS.PLANILLAS_WRITE),
  validate(idParamSchema, 'params'),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const planilla = await PlanillasService.updateStatus(req.params.id, req.body.status);
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
