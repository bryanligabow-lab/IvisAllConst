import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Cargar el .env del root del monorepo si existe
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback al .env local del backend

// Railway/Heroku-style PaaS inyectan PORT; localmente usamos BACKEND_PORT.
if (process.env.PORT && !process.env.BACKEND_PORT) {
  process.env.BACKEND_PORT = process.env.PORT;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(10),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Variables de entorno inválidas:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  REDIS_URL: parsed.data.REDIS_URL && parsed.data.REDIS_URL.length > 0 ? parsed.data.REDIS_URL : undefined,
};
export type Env = typeof env;
