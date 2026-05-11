import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, buildPaginationMeta } from '../../utils/apiResponse';
import { getPagination } from '../../utils/pagination';
import { PERMISSIONS } from '../../shared/constants/roles.constants';
import { idParamSchema } from '../../shared/dto/id-param.dto';

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
      },
    });
    return success(res, user);
  }),
);

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
    return success(res, updated);
  }),
);
