export interface ITokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface IRefreshPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSec: number;
  refreshExpiresInSec: number;
}

export interface IAuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface ISessionContext {
  ipAddress?: string;
  userAgent?: string;
}
