import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Redis es OPCIONAL. Si `REDIS_URL` no está configurado se exporta `null`
 * y los consumidores (rate limiter, etc.) usan implementación en memoria.
 */
export const redis: Redis | null = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number): number => Math.min(times * 200, 5000),
    })
  : null;

if (redis) {
  redis.on('connect', () => logger.info('Redis conectado'));
  redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
}

export async function connectRedis(): Promise<void> {
  if (!redis) {
    logger.warn('Redis no configurado — usando rate limiter en memoria (sólo dev)');
    return;
  }
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) await redis.quit();
}
