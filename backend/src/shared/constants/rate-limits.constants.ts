/** Límites de rate limiting por endpoint. Todos los valores deben venir de aquí. */

export interface RateLimitDef {
  /** Ventana en milisegundos */
  windowMs: number;
  /** Máximo de peticiones en la ventana */
  max: number;
  /** Prefijo en Redis para evitar colisiones */
  prefix: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * MINUTE, max: 5, prefix: 'login' } satisfies RateLimitDef,
  REGISTER: { windowMs: HOUR, max: 3, prefix: 'register' } satisfies RateLimitDef,
  PASSWORD_RESET: { windowMs: HOUR, max: 3, prefix: 'pwreset' } satisfies RateLimitDef,
  UPLOADS: { windowMs: HOUR, max: 10, prefix: 'uploads' } satisfies RateLimitDef,
} as const;
