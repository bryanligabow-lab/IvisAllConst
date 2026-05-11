import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { exportProformaExcel } from './proformas.excel';
import { exportProformaPdf } from './proformas.pdf';

const itemSchema = z.object({
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(40),
  description: z.string().min(1).max(500),
  unitPrice: z.coerce.number().nonnegative(),
});

const createSchema = z.object({
  number: z.string().min(1).max(40).optional(),
  date: z.coerce.date().optional(),
  clientName: z.string().min(1).max(300),
  clientRuc: z.string().max(40).optional(),
  clientAddress: z.string().max(500).optional(),
  clientResponsible: z.string().max(200).optional(),
  projectId: z.string().uuid().optional().nullable(),
  projectLabel: z.string().max(200).optional(),
  ivaPercent: z.coerce.number().min(0).max(100).default(15),
  creditTerm: z.string().max(200).optional(),
  paymentTerms: z.string().max(200).optional(),
  validity: z.string().max(200).optional(),
  topClients: z.string().max(1000).optional(),
  signerName: z.string().max(200).optional(),
  signerTitle: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']).optional(),
  items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
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
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute totals for each
    const withTotals = items.map((p) => {
      const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const iva = subtotal * (p.ivaPercent / 100);
      const total = subtotal + iva;
      return { ...p, subtotal, iva, total };
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
        items: { orderBy: { orderIndex: 'asc' } },
      },
    });
    if (!p) throw new NotFoundError('Proforma no encontrada');
    const subtotal = p.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const iva = subtotal * (p.ivaPercent / 100);
    const total = subtotal + iva;
    return success(res, { ...p, subtotal, iva, total });
  }),
);

proformasRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const number = req.body.number ?? (await nextProformaNumber());

    const created = await prisma.proforma.create({
      data: {
        number,
        date: req.body.date ?? new Date(),
        clientName: req.body.clientName,
        clientRuc: req.body.clientRuc || null,
        clientAddress: req.body.clientAddress || null,
        clientResponsible: req.body.clientResponsible || null,
        projectId: req.body.projectId || null,
        projectLabel: req.body.projectLabel || null,
        ivaPercent: req.body.ivaPercent ?? 15,
        creditTerm: req.body.creditTerm || null,
        paymentTerms: req.body.paymentTerms || null,
        validity: req.body.validity || null,
        topClients: req.body.topClients || null,
        signerName: req.body.signerName || null,
        signerTitle: req.body.signerTitle || null,
        notes: req.body.notes || null,
        status: req.body.status ?? 'DRAFT',
        createdBy: req.user.id,
        items: {
          create: req.body.items.map((it: z.infer<typeof itemSchema>, idx: number) => ({
            orderIndex: idx,
            quantity: it.quantity,
            unit: it.unit,
            description: it.description,
            unitPrice: it.unitPrice,
          })),
        },
      },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
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

    const { items, ...rest } = req.body;
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
          })),
        });
      }
      const cleaned = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      );
      return tx.proforma.update({
        where: { id: req.params.id },
        data: cleaned,
        include: { items: { orderBy: { orderIndex: 'asc' } } },
      });
    });
    return success(res, updated);
  }),
);

proformasRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROFORMAS_WRITE),
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
