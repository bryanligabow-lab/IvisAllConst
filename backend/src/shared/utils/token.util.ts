import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { REGEX } from '../constants/regex.constants';
import { TOKEN_HASH_ALGO } from '../constants/auth.constants';
import type { ITokenPayload, IRefreshPayload } from '../interfaces/auth.interface';

/** Convierte TTLs tipo "15m" / "7d" en segundos. */
export function parseTtlToSeconds(ttl: string): number {
  const m = REGEX.TTL.exec(ttl);
  if (!m) throw new Error(`TTL inválido: ${ttl}`);
  const value = Number(m[1]);
  const unit = m[2] as 's' | 'm' | 'h' | 'd';
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return value * mult;
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  const jti = crypto.randomBytes(32).toString('hex');
  return jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): ITokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as ITokenPayload;
}

export function verifyRefreshToken(token: string): IRefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as IRefreshPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash(TOKEN_HASH_ALGO).update(token).digest('hex');
}

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}
