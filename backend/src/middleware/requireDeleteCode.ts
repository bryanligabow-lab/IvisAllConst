import type { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Requires the authenticated user to send their 6-digit delete code in the
 * `X-Delete-Code` header (or `deleteCode` body field). Used to gate destructive
 * operations like deleting projects, gastos, planillas, payment orders, etc.
 *
 * If the user has no delete code set, the request is rejected — admins must
 * set one for each user during provisioning.
 */
export const requireDeleteCode: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError('No autenticado');

  const headerCode = (req.headers['x-delete-code'] as string | undefined)?.trim();
  const bodyCode = typeof req.body?.deleteCode === 'string' ? req.body.deleteCode.trim() : undefined;
  const code = headerCode || bodyCode;

  if (!code) {
    throw new UnauthorizedError('Se requiere el código de eliminación de 6 dígitos');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new UnauthorizedError('El código de eliminación debe tener 6 dígitos');
  }

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { deleteCodeHash: true },
  });
  if (!u?.deleteCodeHash) {
    throw new UnauthorizedError('Tu usuario no tiene código de eliminación configurado. Pídele a un administrador que te genere uno.');
  }
  const ok = await bcrypt.compare(code, u.deleteCodeHash);
  if (!ok) {
    throw new UnauthorizedError('Código de eliminación incorrecto');
  }
  next();
});
