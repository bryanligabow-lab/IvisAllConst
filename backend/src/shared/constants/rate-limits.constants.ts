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
  // Cuenta SOLO los intentos FALLIDOS (ver loginLimiter: skipSuccessfulRequests).
  // Tope alto porque una oficina suele compartir una sola IP pública (NAT) y un
  // tope bajo bloquearía a todos a la vez. 40 fallos/15min sigue frenando fuerza bruta.
  LOGIN: { windowMs: 15 * MINUTE, max: 40, prefix: 'login' } satisfies RateLimitDef,
  REGISTER: { windowMs: HOUR, max: 3, prefix: 'register' } satisfies RateLimitDef,
  PASSWORD_RESET: { windowMs: HOUR, max: 3, prefix: 'pwreset' } satisfies RateLimitDef,
  UPLOADS: { windowMs: HOUR, max: 10, prefix: 'uploads' } satisfies RateLimitDef,
} as const;
