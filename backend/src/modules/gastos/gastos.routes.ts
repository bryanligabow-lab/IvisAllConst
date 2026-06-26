import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, buildPaginationMeta } from '../../utils/apiResponse';
import { getPagination } from '../../utils/pagination';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { ERRORS, SUCCESS } from '../../shared/constants/error-messages';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';
import { exportGastosExcel } from './gastos.excel';

const docSchema = z.object({
  base64: z.string().min(10),
  mime: z.string().regex(/^(image\/|application\/pdf$)/, 'Tipo de archivo no válido'),
  filename: z.string().max(200).optional(),
});

const createGastoSchema = z.object({
  projectId: z.string().uuid(),
  rubroId: z.string().uuid(),
  providerId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(300),
  invoiceNumber: z.string().max(80).optional(),
  amount: z.coerce.number().positive(),
  gastoDate: calendarDateSchema,
  // Tipo de gasto: normal (proveedor) o anticipo/pago a subcontratista.
  kind: z.enum(['EXPENSE', 'SUBCONTRACTOR']).optional(),
  attachmentUrl: z.string().url().max(2000).optional(),
  // Foto/PDF de la factura (base64 sin prefijo). null para quitarla.
  invoiceBase64: z.string().min(10).nullable().optional(),
  invoiceMime: z
    .string()
    .regex(/^(image\/|application\/pdf$)/, 'Tipo de archivo no válido')
    .nullable()
    .optional(),
  // Varias facturas/documentos (foto o PDF) a adjuntar.
  documents: z.array(docSchema).max(15).optional(),
});

const updateGastoSchema = createGastoSchema
  .partial()
  .omit({ projectId: true })
  .extend({ removeDocumentIds: z.array(z.string().uuid()).optional() });

const listQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  rubroId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
});

const exportQuerySchema = z.object({
  projectId: z.string().uuid(),
  rubroId: z.string().uuid().optional(),
});

export const gastosRouter = Router();
gastosRouter.use(authenticate);

gastosRouter.get(
  '/',
  requirePermission(PERMISSIONS.GASTOS_READ),
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, perPage, skip, take } = getPagination(req);
    const where = {
      deletedAt: null,
      ...(req.query.projectId ? { projectId: req.query.projectId as string } : {}),
      ...(req.query.rubroId ? { rubroId: req.query.rubroId as string } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.gasto.findMany({
        where,
        skip,
        take,
        orderBy: { gastoDate: 'desc' },
        omit: { invoiceImageData: true },
        include: {
          rubro: { select: { code: true, name: true } },
          provider: { select: { id: true, name: true, service: true } },
          paymentOrder: { select: { id: true, description: true } },
          documents: {
            select: { id: true, mimeType: true, filename: true },
            orderBy: { orderIndex: 'asc' },
          },
        },
      }),
      prisma.gasto.count({ where }),
    ]);

    return success(res, items, 200, buildPaginationMeta(total, page, perPage));
  }),
);

gastosRouter.post(
  '/',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  validate(createGastoSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    const rubro = await prisma.rubro.findFirst({
      where: { id: req.body.rubroId, projectId: req.body.projectId, deletedAt: null },
    });
    if (!rubro) throw new NotFoundError(ERRORS.RUBRO_NOT_IN_PROJECT);

    const { providerId, invoiceBase64, invoiceMime, documents, ...rest } = req.body;
    const hasImg = !!invoiceBase64;
    const docs = (documents ?? []) as Array<z.infer<typeof docSchema>>;
    const created = await prisma.gasto.create({
      data: {
        ...rest,
        providerId: providerId || null,
        invoiceImageData: hasImg ? Buffer.from(invoiceBase64, 'base64') : null,
        invoiceImageMime: hasImg ? (invoiceMime ?? 'image/jpeg') : null,
        documents: {
          create: docs.map((d, i) => ({
            orderIndex: i,
            mimeType: d.mime,
            data: Buffer.from(d.base64, 'base64'),
            filename: d.filename ?? null,
          })),
        },
        createdBy: req.user.id,
      },
      omit: { invoiceImageData: true },
    });
    return success(res, created, 201);
  }),
);

gastosRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateGastoSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.gasto.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError(ERRORS.GASTO_NOT_FOUND);
    const { invoiceBase64, invoiceMime, documents, removeDocumentIds, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (invoiceBase64 === null) {
      data.invoiceImageData = null;
      data.invoiceImageMime = null;
    } else if (typeof invoiceBase64 === 'string') {
      data.invoiceImageData = Buffer.from(invoiceBase64, 'base64');
      data.invoiceImageMime = invoiceMime ?? 'image/jpeg';
    }

    const docs = (documents ?? []) as Array<z.infer<typeof docSchema>>;
    const toRemove = (removeDocumentIds ?? []) as string[];
    if (toRemove.length > 0) {
      await prisma.gastoDocument.deleteMany({
        where: { id: { in: toRemove }, gastoId: req.params.id },
      });
    }
    if (docs.length > 0) {
      const base = await prisma.gastoDocument.count({ where: { gastoId: req.params.id } });
      await prisma.gastoDocument.createMany({
        data: docs.map((d, i) => ({
          gastoId: req.params.id,
          orderIndex: base + i,
          mimeType: d.mime,
          data: Buffer.from(d.base64, 'base64'),
          filename: d.filename ?? null,
        })),
      });
    }

    const updated = await prisma.gasto.update({
      where: { id: req.params.id },
      data,
      omit: { invoiceImageData: true },
    });
    return success(res, updated);
  }),
);

// Sirve la foto/PDF de la factura del gasto (protegido por token).
gastosRouter.get(
  '/:id/invoice',
  requirePermission(PERMISSIONS.GASTOS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const g = await prisma.gasto.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { invoiceImageData: true, invoiceImageMime: true },
    });
    if (!g || !g.invoiceImageData || !g.invoiceImageMime) {
      throw new NotFoundError('Factura no encontrada');
    }
    res.setHeader('Content-Type', g.invoiceImageMime);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(g.invoiceImageData));
  }),
);

// Sirve un documento (factura) específico del gasto.
gastosRouter.get(
  '/:id/documents/:docId',
  requirePermission(PERMISSIONS.GASTOS_READ),
  asyncHandler(async (req, res) => {
    const doc = await prisma.gastoDocument.findFirst({
      where: { id: req.params.docId, gastoId: req.params.id },
      select: { mimeType: true, data: true },
    });
    if (!doc) throw new NotFoundError('Documento no encontrado');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(doc.data));
  }),
);

gastosRouter.get(
  '/export',
  requirePermission(PERMISSIONS.GASTOS_READ),
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    await exportGastosExcel(
      req.query.projectId as string,
      req.query.rubroId as string | undefined,
      res,
    );
  }),
);

gastosRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.GASTOS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.gasto.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: SUCCESS.GASTO_DELETED });
  }),
);
