import { buildApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const app = buildApp();

  const server = app.listen(env.BACKEND_PORT, () => {
    logger.info(`API escuchando en :${env.BACKEND_PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info(`Recibida señal ${signal}, cerrando...`);
    server.close(async () => {
      try {
        await disconnectDatabase();
        await disconnectRedis();
        process.exit(0);
      } catch (err) {
        logger.error('Error al cerrar', { error: (err as Error).message });
        process.exit(1);
      }
    });

    // Forzar cierre si tarda demasiado
    setTimeout(() => {
      logger.error('Cierre forzado por timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('UnhandledRejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('UncaughtException', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error('Arranque fallido', { error: (err as Error).message });
  process.exit(1);
});
