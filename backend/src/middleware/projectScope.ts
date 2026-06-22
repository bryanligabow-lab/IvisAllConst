import type { Request, RequestHandler } from 'express';
import { prisma } from '../config/database';
import { ROLES } from '../shared/constants/roles.constants';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Roles que ven TODOS los proyectos (sin restricción por asignación).
 * El resto (p. ej. `operador`) queda limitado a sus proyectos asignados.
 */
const UNRESTRICTED_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.VIEWER];

export function isScopedUser(req: Request): boolean {
  if (!req.user) return false;
  return !req.user.roles.some((r) => UNRESTRICTED_ROLES.includes(r));
}

/**
 * Calcula a qué proyectos puede acceder el usuario y lo deja en
 * `req.allowedProjectIds` (null = sin restricción). Debe ir DESPUÉS de
 * `authenticate` y ANTES de cualquier handler que lea proyectos.
 */
export const loadProjectScope: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();
  if (!isScopedUser(req)) {
    req.allowedProjectIds = null;
    return next();
  }
  const assignments = await prisma.projectAssignment.findMany({
    where: { userId: req.user.id },
    select: { projectId: true },
  });
  req.allowedProjectIds = assignments.map((a) => a.projectId);
  next();
});

/**
 * Bloquea el acceso a un proyecto concreto cuando el usuario está restringido.
 * `getId` extrae el id de proyecto del request (params/query/body).
 */
export function requireProjectAccess(
  getId: (req: Request) => string | undefined,
): RequestHandler {
  return (req, _res, next) => {
    const allowed = req.allowedProjectIds;
    if (allowed == null) return next(); // sin restricción
    const id = getId(req);
    if (!id || !allowed.includes(id)) {
      return next(new ForbiddenError('No tienes acceso a este proyecto'));
    }
    next();
  };
}

/** Cláusula `where` para filtrar por proyectos permitidos en listados. */
export function projectScopeWhere(req: Request): { projectId?: { in: string[] } } {
  const allowed = req.allowedProjectIds;
  if (allowed == null) return {};
  return { projectId: { in: allowed } };
}
