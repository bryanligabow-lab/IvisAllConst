import { Router } from 'express';
import { z } from 'zod';
import { ProjectsController } from './projects.controller';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { loadProjectScope, requireProjectAccess } from '../../middleware/projectScope';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createProjectSchema, updateProjectSchema, idParamSchema } from './projects.validation';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { exportProjectsReport } from './projects.excel';
import { prisma } from '../../config/database';
import { success } from '../../utils/apiResponse';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors';

export const projectsRouter = Router();
projectsRouter.use(authenticate);
projectsRouter.use(loadProjectScope);

const accessByParamId = requireProjectAccess((req) => req.params.id);

projectsRouter.get(
  '/',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(ProjectsController.list),
);
projectsRouter.get(
  '/stats/global',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(ProjectsController.globalStats),
);
projectsRouter.get(
  '/report/export',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  asyncHandler(async (_req, res) => {
    await exportProjectsReport(res);
  }),
);
projectsRouter.post(
  '/',
  requirePermission(PERMISSIONS.PROJECTS_CREATE),
  validate(createProjectSchema),
  asyncHandler(ProjectsController.create),
);
projectsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  validate(idParamSchema, 'params'),
  accessByParamId,
  asyncHandler(ProjectsController.get),
);
projectsRouter.get(
  '/:id/summary',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  validate(idParamSchema, 'params'),
  accessByParamId,
  asyncHandler(ProjectsController.summary),
);
projectsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateProjectSchema),
  asyncHandler(ProjectsController.update),
);
projectsRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROJECTS_DELETE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(ProjectsController.remove),
);

// ============================================================
// Project documents (contracts, plans, permits, etc.)
// ============================================================

const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'text/csv',
]);

const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB

const uploadDocSchema = z.object({
  label: z.string().max(200).optional(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  dataBase64: z.string().min(1, 'Archivo vacío'),
});

// List documents (metadata only — never sends the bytes)
projectsRouter.get(
  '/:id/documents',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  validate(idParamSchema, 'params'),
  accessByParamId,
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError('Proyecto no encontrado');

    const docs = await prisma.projectDocument.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        uploader: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    return success(res, docs);
  }),
);

// Upload a document
projectsRouter.post(
  '/:id/documents',
  requirePermission(PERMISSIONS.PROJECTS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(uploadDocSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundError('Proyecto no encontrado');

    const { label, filename, mimeType, dataBase64 } = req.body as {
      label?: string;
      filename: string;
      mimeType: string;
      dataBase64: string;
    };

    if (!ALLOWED_DOC_MIME.has(mimeType)) {
      throw new BadRequestError(
        'Tipo de archivo no permitido. Acepta PDF, imágenes, Word, Excel, CSV, TXT y ZIP.',
      );
    }

    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length === 0) throw new BadRequestError('El archivo está vacío');
    if (buf.length > MAX_DOC_BYTES) {
      throw new BadRequestError(`El archivo excede el límite de ${MAX_DOC_BYTES / 1024 / 1024} MB`);
    }

    const doc = await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        label: label?.trim() || null,
        filename,
        mimeType,
        fileSize: buf.length,
        data: buf,
        uploadedBy: req.user.id,
      },
      select: {
        id: true,
        label: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        uploader: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    return success(res, doc, 201);
  }),
);

// Download a document (serves the binary content)
projectsRouter.get(
  '/:id/documents/:docId',
  requirePermission(PERMISSIONS.PROJECTS_READ),
  accessByParamId,
  asyncHandler(async (req, res) => {
    const doc = await prisma.projectDocument.findFirst({
      where: { id: req.params.docId, projectId: req.params.id, deletedAt: null },
    });
    if (!doc) throw new NotFoundError('Documento no encontrado');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.filename)}"`,
    );
    res.setHeader('Content-Length', String(doc.fileSize));
    res.send(Buffer.from(doc.data));
  }),
);

// Delete a document (requires the 6-digit code)
projectsRouter.delete(
  '/:id/documents/:docId',
  requirePermission(PERMISSIONS.PROJECTS_UPDATE),
  requireDeleteCode,
  asyncHandler(async (req, res) => {
    const doc = await prisma.projectDocument.findFirst({
      where: { id: req.params.docId, projectId: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!doc) throw new NotFoundError('Documento no encontrado');
    await prisma.projectDocument.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });
    return success(res, { ok: true });
  }),
);
