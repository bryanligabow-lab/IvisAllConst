import type { RequestHandler } from 'express';
import { prisma } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import { ERRORS } from '../shared/constants/error-messages';
import { AUTH_HEADER_SCHEME } from '../shared/constants/auth.constants';
import { verifyAccessToken } from '../shared/utils/token.util';

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const prefix = `${AUTH_HEADER_SCHEME} `.toLowerCase();
  if (!header || !header.toLowerCase().startsWith(prefix)) {
    throw new UnauthorizedError(ERRORS.ACCESS_TOKEN_MISSING);
  }

  const token = header.slice(prefix.length).trim();
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError(ERRORS.ACCESS_TOKEN_INVALID);
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null, isActive: true },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) throw new UnauthorizedError(ERRORS.USER_INVALID);

  const roles = user.roles.map((ur) => ur.role.name);
  const permissions = Array.from(
    new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name))),
  );

  req.user = { id: user.id, email: user.email, roles, permissions };
  next();
});
