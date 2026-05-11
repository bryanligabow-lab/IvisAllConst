import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/errors';
import { failure } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { ERRORS } from '../shared/constants/error-messages';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return failure(res, err.code, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    return failure(res, 'VALIDATION_ERROR', ERRORS.VALIDATION_FAILED, 422, err.flatten());
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return failure(res, 'CONFLICT', ERRORS.CONFLICT_DUPLICATE, 409, { target: err.meta?.target });
    }
    if (err.code === 'P2025') {
      return failure(res, 'NOT_FOUND', ERRORS.NOT_FOUND, 404);
    }
  }

  logger.error('Unhandled error', {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return failure(res, 'INTERNAL_ERROR', ERRORS.INTERNAL, 500);
};
