import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { requireDeleteCode } from '../../middleware/requireDeleteCode';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, buildPaginationMeta } from '../../utils/apiResponse';
import { getPagination } from '../../utils/pagination';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';
import { ConflictError, NotFoundError } from '../../utils/errors';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (req, res) => {
    const { page, perPage, skip, take } = getPagination(req);
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);
    return success(res, items, 200, buildPaginationMeta(total, page, perPage));
  }),
);

usersRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_READ),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
        projectAssignments: { select: { projectId: true } },
      },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const { projectAssignments, ...rest } = user;
    return success(res, { ...rest, projectIds: projectAssignments.map((a) => a.projectId) });
  }),
);

function generateDeleteCode(): string {
  const buf = randomBytes(4).readUInt32BE(0);
  return (buf % 1_000_000).toString().padStart(6, '0');
}

const createUserSchema = z.object({
  email: z.string().email().max(120),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  password: z.string().min(8).max(120),
  roleIds: z.array(z.string().uuid()).optional(),
  // Proyectos asignados (relevante para el rol operador).
  projectIds: z.array(z.string().uuid()).optional(),
});

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { email, firstName, lastName, password, roleIds, projectIds } = req.body as {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      roleIds?: string[];
      projectIds?: string[];
    };

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictError('Ya existe un usuario con ese correo');

    const deleteCode = generateDeleteCode();
    const [passwordHash, deleteCodeHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(deleteCode, 10),
    ]);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        passwordHash,
        deleteCodeHash,
        emailVerified: true,
        isActive: true,
        ...(roleIds && roleIds.length
          ? {
              roles: {
                create: roleIds.map((roleId) => ({
                  roleId,
                  assignedBy: req.user!.id,
                })),
              },
            }
          : {}),
        ...(projectIds && projectIds.length
          ? {
              projectAssignments: {
                create: projectIds.map((projectId) => ({
                  projectId,
                  assignedBy: req.user!.id,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    });

    return success(res, { ...user, deleteCode }, 201);
  }),
);

const resetDeleteCodeSchema = z.object({});

usersRouter.post(
  '/:id/reset-delete-code',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(resetDeleteCodeSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const deleteCode = generateDeleteCode();
    const deleteCodeHash = await bcrypt.hash(deleteCode, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deleteCodeHash },
    });
    return success(res, { deleteCode });
  }),
);

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(120),
});

usersRouter.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    });
    return success(res, { ok: true });
  }),
);

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const { roleIds, projectIds, ...rest } = req.body as {
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      roleIds?: string[];
      projectIds?: string[];
    };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: req.params.id },
        data: rest,
        select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
      });
      if (Array.isArray(roleIds)) {
        await tx.userRole.deleteMany({ where: { userId: req.params.id } });
        if (roleIds.length) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({
              userId: req.params.id,
              roleId,
              assignedBy: req.user!.id,
            })),
            skipDuplicates: true,
          });
        }
      }
      if (Array.isArray(projectIds)) {
        await tx.projectAssignment.deleteMany({ where: { userId: req.params.id } });
        if (projectIds.length) {
          await tx.projectAssignment.createMany({
            data: projectIds.map((projectId) => ({
              userId: req.params.id,
              projectId,
              assignedBy: req.user!.id,
            })),
            skipDuplicates: true,
          });
        }
      }
      return u;
    });
    return success(res, updated);
  }),
);

usersRouter.get(
  '/roles/list',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, isSystem: true },
    });
    return success(res, roles);
  }),
);

usersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  requireDeleteCode,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user?.id) {
      throw new ConflictError('No puedes eliminar tu propio usuario');
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return success(res, { ok: true });
  }),
);
