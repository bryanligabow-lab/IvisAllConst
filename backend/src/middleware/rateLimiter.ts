import rateLimit, { type Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { RATE_LIMITS, type RateLimitDef } from '../shared/constants/rate-limits.constants';
import { ERRORS } from '../shared/constants/error-messages';

function buildLimiter(def: RateLimitDef, opts: Partial<Options> = {}) {
  // Si hay Redis, usar store distribuido. Si no, store en memoria (dev).
  const redisClient = redis;
  const store = redisClient
    ? new RedisStore({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendCommand: ((...args: string[]) =>
          redisClient.call(...(args as [string, ...string[]]))) as any,
        prefix: `rl:${def.prefix}:`,
      })
    : undefined;

  return rateLimit({
    windowMs: def.windowMs,
    max: def.max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: {
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message: ERRORS.TOO_MANY_REQUESTS },
    },
    ...opts,
  });
}

export const generalLimiter = buildLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  prefix: 'general',
});
export const loginLimiter = buildLimiter(RATE_LIMITS.LOGIN);
export const registerLimiter = buildLimiter(RATE_LIMITS.REGISTER);
export const passwordResetLimiter = buildLimiter(RATE_LIMITS.PASSWORD_RESET);
export const uploadsLimiter = buildLimiter(RATE_LIMITS.UPLOADS);
