import type { RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.id,
      ip: req.ip,
    });
  });

  next();
};
