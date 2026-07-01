import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { calendarDateSchema } from '../../shared/utils/date.util';
import { exportProformaExcel } from './proformas.excel';
import { exportProformaPdf } from './proformas.pdf';
import { computeProformaTotals } from './proforma-totals';

const itemSchema = z.object({
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(40),
  description: z.string().min(1).max(500),
  unitPrice: z.coerce.number().nonnegative(),
  // % de IVA de este rubro (null/ausente = usa el IVA general).
  vatPercent: z.coerce.number().min(0).max(100).nullable().optional(),
});

const imageSchema = z.object({
  mimeType: z.string().regex(/^image\//, 'Tipo de imagen no válido'),
  dataBase64: z.string().min(10), // raw base64 (without data:... prefix)
  caption: z.string().max(200).optional(),
  filename: z.string().max(200).optional(),
  // Índice del ítem al que pertenece (para mostrarla junto a ese rubro).
  // Null/ausente = imagen general (al final del PDF).
  itemIndex: z.coerce.number().int().nonnegative().nullable().optional(),
});

const DEFAULTS = {
  creditTerm: '30 días',
  paymentTerms: '100% contraentrega',
  validity: '10 días',
  topClients: 'GAD Canton El Empalme.\nAmbiesa S.A.\nMinisterio de Educación, coordinacion zonal',
  signerName: 'Gabriel Constantine L.',
  signerTitle: 'Gerente General',
};

const createSchema = z.object({
  number: z.string().min(1).max(40).optional(),
  date: calendarDateSchema.optional(),
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().min(1).max(300).optional(), // optional if clientId provided
  clientRuc: z.string().max(40).optional(),
  clientAddress: z.string().max(500).optional(),
  clientResponsible: z.string().max(200).optional(),
  projectId: z.string().uuid().optional().nullable(),
  projectLabel: z.string().max(200).optional(),
  ivaPercent: z.coerce.number().min(0).max(100).default(15),
  creditTerm: z.string().max(200).optional(),
  paymentTerms: z.string().max(200).optional(),
  validity: z.string().max(200).optional(),
  topClients: z.string().max(2000).optional(),
  signerName: z.string().max(200).optional(),
  signerTitle: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']).optional(),
  items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
  images: z.array(imageSchema).max(60).optional(),
});

const updateSchema = createSchema.partial().extend({
  items: z.array(itemSchema).optional(),
});

async function nextProformaNumber(): Promise<string> {
  const last = await prisma.proforma.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });
  if (!last) return '001-001';
  const m = /(\d+)-(\d+)/.exec(last.number);
  if (!m) return '001-001';
  const series = m[1];
  const next = String(parseInt(m[2], 10) + 1).padStart(3, '0');
  return `${series}-${next}`;
}

function applyDefaults<T extends Record<string, unknown>>(body: T): T {
  const out = { ...body };
  for (const k of ['creditTerm', 'paymentTerms', 'validity', 'topClients', 'signerName', 'signerTitle'] as const) {
    if (!out[k]) {
      (out as Record<string, unknown>)[k] = DEFAULTS[k];
    }
  }
  return out;
}

export const proformasRouter = Router();
proformasRouter.use(authenticate);

proformasRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  asyncHandler(async (_req, res) => {
    const items = await prisma.proforma.findMany({
      where: { deletedAt: null },
      include: {
        project: { select: { id: true, name: true, code: true } },
        client: { select: { id: true, name: true, ruc: true } },
        items: true,
        images: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const withTotals = items.map((p) => {
      const t = computeProformaTotals(p.items, p.ivaPercent);
      return {
        ...p,
        subtotal: t.subtotal,
        iva: t.iva,
        total: t.total,
        vatBreakdown: t.breakdown,
        imagesCount: p.images.length,
      };
    });
    return success(res, withTotals);
  }),
);

proformasRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const p = await prisma.proforma.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        project: { select: { id: true, name: true, code: true } },
        client: { select: { id: true, name: true, ruc: true } },
        items: { orderBy: { orderIndex: 'asc' } },
        images: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            mimeType: true,
            caption: true,
            filename: true,
            orderIndex: true,
            itemIndex: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundError('Proforma no encontrada');
    const t = computeProformaTotals(p.items, p.ivaPercent);
    return success(res, {
      ...p,
      subtotal: t.subtotal,
      iva: t.iva,
      total: t.total,
      vatBreakdown: t.breakdown,
    });
  }),
);

// Endpoint para servir una imagen individual (para previewing en frontend)
proformasRouter.get(
  '/:id/images/:imageId',
  requirePermission(PERMISSIONS.PROFORMAS_READ),
  asyncHandler(async (req, res) => {
    const img = await prisma.proformaImage.findFirst({
      where: { id: req.params.imageId, proformaId: req.params.id },
    });
    if (!img) throw new NotFoundError('Imagen no encontrada');
    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(Buffer.from(img.data));
  }),
);

proformasRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const number = req.body.number ?? (await nextProformaNumber());
    const body = applyDefaults(req.body);

    // Snapshot client info if clientId provided
    let clientFields = {
      clientName: body.clientName,
      clientRuc: body.clientRuc,
      clientAddress: body.clientAddress,
      clientResponsible: body.clientResponsible,
    };
    if (body.clientId) {
      const c = await prisma.client.findFirst({
        where: { id: body.clientId as string, deletedAt: null },
      });
      if (!c) throw new BadRequestError('Cliente no encontrado');
      clientFields = {
        clientName: body.clientName || c.name,
        clientRuc: body.clientRuc || c.ruc || undefined,
        clientAddress: body.clientAddress || c.address || undefined,
        clientResponsible: body.clientResponsible || c.responsible || undefined,
      };
    }
    if (!clientFields.clientName) {
      throw new BadRequestError('Debes indicar el nombre del cliente o seleccionar uno guardado');
    }

    const images = (body.images as z.infer<typeof imageSchema>[] | undefined) ?? [];

    const created = await prisma.proforma.create({
      data: {
        number,
        date: body.date ?? new Date(),
        clientId: (body.clientId as string | null) || null,
        clientName: clientFields.clientName,
        clientRuc: clientFields.clientRuc || null,
        clientAddress: clientFields.clientAddress || null,
        clientResponsible: clientFields.clientResponsible || null,
        projectId: (body.projectId as string | null) || null,
        projectLabel: body.projectLabel || null,
        ivaPercent: body.ivaPercent ?? 15,
        creditTerm: body.creditTerm,
        paymentTerms: body.paymentTerms,
        validity: body.validity,
        topClients: body.topClients,
        signerName: body.signerName,
        signerTitle: body.signerTitle,
        notes: body.notes || null,
        status: body.status ?? 'DRAFT',
        createdBy: req.user.id,
        items: {
          create: req.body.items.map((it: z.infer<typeof itemSchema>, idx: number) => ({
            orderIndex: idx,
            quantity: it.quantity,
            unit: it.unit,
            description: it.description,
            unitPrice: it.unitPrice,
            vatPercent: it.vatPercent ?? null,
          })),
        },
        images: {
          create: images.map((img, idx) => ({
            orderIndex: idx,
            itemIndex: img.itemIndex ?? null,
            mimeType: img.mimeType,
            data: Buffer.from(img.dataBase64, 'base64'),
            caption: img.caption || null,
            filename: img.filename || null,
          })),
        },
      },
      include: {
        items: { orderBy: { orderIndex: 'asc' } },
        images: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            mimeType: true,
            caption: true,
            filename: true,
            orderIndex: true,
            itemIndex: true,
          },
        },
      },
    });

    return success(res, created, 201);
  }),
);

proformasRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(idParamSchema, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const exists = await prisma.proforma.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!exists) throw new NotFoundError('Proforma no encontrada');

    const { items, images, ...rest } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.proformaItem.deleteMany({ where: { proformaId: req.params.id } });
        await tx.proformaItem.createMany({
          data: items.map((it: z.infer<typeof itemSchema>, idx: number) => ({
            proformaId: req.params.id,
            orderIndex: idx,
            quantity: it.quantity,
            unit: it.unit,
            description: it.description,
            unitPrice: it.unitPrice,
            vatPercent: it.vatPercent ?? null,
          })),
        });
      }
      if (images !== undefined) {
        await tx.proformaImage.deleteMany({ where: { proformaId: req.params.id } });
        for (const [idx, img] of (images as z.infer<typeof imageSchema>[]).entries()) {
          await tx.proformaImage.create({
            data: {
              proformaId: req.params.id,
              orderIndex: idx,
              itemIndex: img.itemIndex ?? null,
              mimeType: img.mimeType,
              data: Buffer.from(img.dataBase64, 'base64'),
              caption: img.caption || null,
              filename: img.filename || null,
            },
          });
        }
      }
      const cleaned = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      return tx.proforma.update({
        where: { id: req.params.id },
        data: cleaned,
        include: {
          items: { orderBy: { orderIndex: 'asc' } },
          images: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              mimeType: true,
              caption: true,
              filename: true,
              orderIndex: true,
              itemIndex: true,
            },
          },
        },
      });
    });
    return success(res, updated);
  }),
);

proformasRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await prisma.proforma.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { message: 'Proforma eliminada' });
  }),
);

proformasRouter.get(
  '/:id/export',
  requirePermission(PERMISSIONS.PROFORMAS_EXPORT),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string) || 'pdf';
    if (format === 'xlsx') {
      await exportProformaExcel(req.params.id, res);
      return;
    }
    if (format === 'pdf') {
      await exportProformaPdf(req.params.id, res);
      return;
    }
    throw new BadRequestError(`Formato no soportado: ${format}`);
  }),
);
