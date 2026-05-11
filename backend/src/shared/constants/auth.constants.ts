/**
 * Constantes de autenticación.
 * Los TTLs reales se leen de env (JWT_*_TTL); aquí van los límites y nombres
 * que NO deben cambiar entre entornos.
 */

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/auth';
export const AUTH_HEADER_SCHEME = 'Bearer';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 h

export const LOGIN_ATTEMPTS = {
  MAX_FAILED: 5,
  WINDOW_MS: 15 * 60 * 1000, // 15 min
  LOCK_MINUTES: 30,
} as const;

export const TOKEN_HASH_ALGO = 'sha256';
