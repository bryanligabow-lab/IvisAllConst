import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';
import { logger } from '../../utils/logger';
import { ChequesService, CHEQUE_STATUSES } from './cheques.service';
import { ChequesNotifications } from './cheques.notifications';
import { exportChequesExcel } from './cheques.excel';

const chequeBodySchema = z.object({
  issueDate: calendarDateSchema.nullish(),
  // Fecha en que se VA a cobrar (postfechado) — la que alimenta el calendario.
  dueDate: calendarDateSchema.nullish(),
  number: z.string().max(40).optional(),
  beneficiary: z.string().max(200).nullish(),
  bank: z.string().max(120).nullish(),
  chequeraId: z.string().max(40).nullish(),
  account: z.string().max(80).nullish(),
  amount: z.coerce.number().nonnegative().optional(),
  cashDate: calendarDateSchema.nullish(),
  status: z.enum(CHEQUE_STATUSES).optional(),
  notes: z.string().max(500).nullish(),
});

export const chequesRouter = Router();
chequesRouter.use(authenticate);

chequesRouter.get(
  '/overview',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 15));
    return success(res, await ChequesService.overview(days));
  }),
);

// Resumen tipo dashboard (pantalla principal del módulo).
chequesRouter.get(
  '/resumen',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (_req, res) => {
    return success(res, await ChequesService.resumen());
  }),
);

// Chequeras (cuentas) con sus cifras y próximo folio.
chequesRouter.get(
  '/chequeras',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (_req, res) => {
    return success(res, await ChequesService.chequeras());
  }),
);

// Crea las chequeras y asigna la suya a los cheques que aún no la tienen.
chequesRouter.post(
  '/chequeras/sync',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  asyncHandler(async (_req, res) => {
    return success(res, await ChequesService.ensureChequeras());
  }),
);

chequesRouter.get(
  '/',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (req, res) => {
    const data = await ChequesService.list(req.query as Record<string, string>);
    return success(res, data);
  }),
);

chequesRouter.post(
  '/',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(chequeBodySchema),
  asyncHandler(async (req, res) => {
    const creado = await ChequesService.create(req.body, req.user?.id);
    // Aviso de emisión: sale aparte para no demorar (ni tumbar) el guardado.
    void ChequesNotifications.avisoEmision(creado.id, req.user?.id).catch((err: Error) => {
      logger.error('No se pudo enviar el aviso de emisión del cheque', {
        chequeId: creado.id,
        error: (err as Error).message,
      });
    });
    return success(res, creado, 201);
  }),
);

// Migración masiva del Excel (idempotente).
chequesRouter.post(
  '/import',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.bulkImport(req.body, req.user?.id));
  }),
);

// Puesta al día: marca cobrados todos los pendientes con fecha de cobro <= until.
const bulkCashSchema = z.object({ until: calendarDateSchema });
chequesRouter.post(
  '/bulk-cash',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(bulkCashSchema),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.bulkMarkCashedUntil(req.body.until));
  }),
);

chequesRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(idParamSchema, 'params'),
  validate(chequeBodySchema),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.update(req.params.id, req.body));
  }),
);

// Marcar cobrado / revertir a pendiente.
const cashSchema = z.object({
  cashDate: calendarDateSchema.optional(),
  cashed: z.coerce.boolean().optional(),
});
chequesRouter.post(
  '/:id/cash',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(idParamSchema, 'params'),
  validate(cashSchema),
  asyncHandler(async (req, res) => {
    const cashed = req.body.cashed ?? true;
    const date = req.body.cashDate ?? new Date();
    return success(res, await ChequesService.markCashed(req.params.id, date, cashed));
  }),
);

chequesRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ChequesService.softDelete(req.params.id);
    return success(res, { message: 'Cheque eliminado' });
  }),
);

// Libro de cheques en Excel: una hoja por chequera con todos sus cheques.
chequesRouter.get(
  '/export',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (_req, res) => {
    await exportChequesExcel(res);
  }),
);

// --- Financiamientos ---

chequesRouter.get(
  '/groups',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  asyncHandler(async (_req, res) => {
    return success(res, await ChequesService.groupsOverview());
  }),
);

chequesRouter.get(
  '/groups/:id',
  requirePermission(PERMISSIONS.CHEQUES_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.getGroup(req.params.id));
  }),
);

const groupSchema = z.object({
  name: z.string().min(1).max(120),
  source: z.string().max(120).nullish(),
  notes: z.string().max(500).nullish(),
  chequeraId: z.string().max(40).nullish(),
  // Avisos por correo de ESTE financiamiento: a quiénes y cada cuándo.
  notifyEmails: z.array(z.string().email().max(200)).max(20).nullish(),
  notifyWeekly: z.coerce.boolean().optional(),
  notifyMonthly: z.coerce.boolean().optional(),
  notifyDayBefore: z.coerce.boolean().optional(),
  notifyOnDue: z.coerce.boolean().optional(),
  // Cuotas una por una (nº de cheque, fecha de cobro y monto editables).
  cuotas: z
    .array(
      z.object({
        number: z.string().max(40).nullish(),
        dueDate: calendarDateSchema,
        amount: z.coerce.number().nonnegative(),
      }),
    )
    .max(120)
    .nullish(),
  generate: z
    .object({
      count: z.coerce.number().int().min(1).max(120),
      amount: z.coerce.number().nonnegative(),
      firstDate: calendarDateSchema,
      firstNumber: z.coerce.number().int().nullish(),
    })
    .nullish(),
});
chequesRouter.post(
  '/groups',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(groupSchema),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.createGroup(req.body, req.user?.id), 201);
  }),
);

chequesRouter.patch(
  '/groups/:id',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  validate(idParamSchema, 'params'),
  validate(groupSchema.partial()),
  asyncHandler(async (req, res) => {
    return success(res, await ChequesService.updateGroup(req.params.id, req.body));
  }),
);

chequesRouter.delete(
  '/groups/:id',
  requirePermission(PERMISSIONS.CHEQUES_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ChequesService.deleteGroup(req.params.id);
    return success(res, { message: 'Financiamiento eliminado' });
  }),
);
