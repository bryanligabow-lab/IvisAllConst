import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { rubrosRouter } from './modules/rubros/rubros.routes';
import { gastosRouter } from './modules/gastos/gastos.routes';
import { planillasRouter } from './modules/planillas/planillas.routes';
import { ingresosRouter } from './modules/ingresos/ingresos.routes';
import { paymentOrdersRouter } from './modules/payment-orders/payment-orders.routes';
import { providersRouter } from './modules/providers/providers.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { bitacoraRouter } from './modules/bitacora/bitacora.routes';
import { proformasRouter } from './modules/proformas/proformas.routes';
import { clientsRouter } from './modules/clients/clients.routes';
import { productsRouter } from './modules/products/products.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { healthRouter } from './modules/health/health.routes';
import { failure } from './utils/apiResponse';
import { ERRORS } from './shared/constants/error-messages';

const BODY_LIMIT = '30mb'; // proforma con varias imágenes en base64

export function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      // Permite que el frontend lea el nombre de archivo de las descargas.
      exposedHeaders: ['Content-Disposition'],
    }),
  );

  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.use(requestLogger);

  // Health primero (sin rate limit) para los probes
  app.use('/api/health', healthRouter);

  app.use('/api', generalLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/rubros', rubrosRouter);
  app.use('/api/gastos', gastosRouter);
  app.use('/api/planillas', planillasRouter);
  app.use('/api/ingresos', ingresosRouter);
  app.use('/api/payment-orders', paymentOrdersRouter);
  app.use('/api/providers', providersRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/bitacora', bitacoraRouter);
  app.use('/api/proformas', proformasRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use('/api', (_req, res) => failure(res, 'NOT_FOUND', ERRORS.NOT_FOUND, 404));

  app.use(errorHandler);

  return app;
}
