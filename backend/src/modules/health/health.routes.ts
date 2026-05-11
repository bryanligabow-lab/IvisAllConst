import { Router } from 'express';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { success, failure } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, string> = { db: 'unknown', redis: 'disabled' };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = 'connected';
    } catch {
      checks.db = 'down';
    }
    if (redis) {
      try {
        const pong = await redis.ping();
        checks.redis = pong === 'PONG' ? 'connected' : 'down';
      } catch {
        checks.redis = 'down';
      }
    }

    const allOk = checks.db === 'connected' && checks.redis !== 'down';
    const payload = {
      status: allOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      ...checks,
    };
    return allOk
      ? success(res, payload)
      : failure(res, 'DEGRADED', 'Dependencias degradadas', 503, payload);
  }),
);
