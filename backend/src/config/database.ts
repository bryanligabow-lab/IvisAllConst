import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Postgres conectado');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Postgres desconectado');
}
