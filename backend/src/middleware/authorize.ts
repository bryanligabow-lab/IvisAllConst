import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { ERRORS } from '../shared/constants/error-messages';
import { ROLES } from '../shared/constants/roles.constants';

/**
 * Autoriza si el usuario tiene CUALQUIERA de los permisos listados.
 * super_admin siempre pasa.
 */
export function requirePermission(...needed: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (req.user.roles.includes(ROLES.SUPER_ADMIN)) return next();

    const hasAny = needed.some((p) => req.user!.permissions.includes(p));
    if (!hasAny) throw new ForbiddenError(ERRORS.PERMISSION_REQUIRED(needed.join(' o ')));
    next();
  };
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    const hasAny = req.user.roles.some((r) => roles.includes(r));
    if (!hasAny) throw new ForbiddenError(ERRORS.ROLE_REQUIRED(roles.join(' o ')));
    next();
  };
}
