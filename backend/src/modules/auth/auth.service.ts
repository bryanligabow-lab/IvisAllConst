import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../utils/errors';
import { ERRORS } from '../../shared/constants/error-messages';
import {
  LOGIN_ATTEMPTS,
  PASSWORD_RESET_TTL_MS,
} from '../../shared/constants/auth.constants';
import { DEFAULT_ROLE_FOR_NEW_USERS } from '../../shared/constants/roles.constants';
import { hashPassword, comparePassword } from '../../shared/utils/hash.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRandomToken,
  parseTtlToSeconds,
} from '../../shared/utils/token.util';
import { env } from '../../config/env';
import type { ISessionContext, ITokenPair } from '../../shared/interfaces/auth.interface';
import type { LoginDto, RegisterDto } from './auth.validation';

export class AuthService {
  static async register(dto: RegisterDto): Promise<{ id: string; email: string }> {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictError(ERRORS.EMAIL_ALREADY_REGISTERED);

    const passwordHash = await hashPassword(dto.password);
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    const defaultRole = await prisma.role.findUnique({ where: { name: DEFAULT_ROLE_FOR_NEW_USERS } });
    if (defaultRole) {
      await prisma.userRole.create({ data: { userId: user.id, roleId: defaultRole.id } });
    }

    return { id: user.id, email: user.email };
  }

  static async login(dto: LoginDto, ctx: ISessionContext): Promise<ITokenPair & { userId: string }> {
    const since = new Date(Date.now() - LOGIN_ATTEMPTS.WINDOW_MS);
    const failedCount = await prisma.loginAttempt.count({
      where: { email: dto.email, success: false, createdAt: { gte: since } },
    });
    if (failedCount >= LOGIN_ATTEMPTS.MAX_FAILED) {
      throw new UnauthorizedError(ERRORS.TOO_MANY_LOGIN_ATTEMPTS);
    }

    const user = await prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    const ok = user && (await comparePassword(dto.password, user.passwordHash));

    await prisma.loginAttempt.create({
      data: {
        email: dto.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        success: !!ok,
      },
    });

    if (!ok || !user) throw new UnauthorizedError(ERRORS.INVALID_CREDENTIALS);
    if (!user.isActive) throw new UnauthorizedError(ERRORS.ACCOUNT_INACTIVE);

    const tokens = await this.issueTokenPair(user.id, user.email, ctx);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { ...tokens, userId: user.id };
  }

  private static async issueTokenPair(
    userId: string,
    email: string,
    ctx: ISessionContext,
  ): Promise<ITokenPair> {
    const accessToken = signAccessToken(userId, email);
    const refreshToken = signRefreshToken(userId);
    const refreshExpiresInSec = parseTtlToSeconds(env.JWT_REFRESH_TTL);
    const accessExpiresInSec = parseTtlToSeconds(env.JWT_ACCESS_TTL);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        deviceInfo: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: new Date(Date.now() + refreshExpiresInSec * 1000),
      },
    });

    return { accessToken, refreshToken, accessExpiresInSec, refreshExpiresInSec };
  }

  static async refresh(refreshToken: string, ctx: ISessionContext): Promise<ITokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError(ERRORS.REFRESH_TOKEN_INVALID);
    }

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError(ERRORS.SESSION_EXPIRED);
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
    });
    if (!user) throw new UnauthorizedError(ERRORS.USER_INVALID);

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.email, ctx);
  }

  static async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) return; // no revelar si existe

    const rawToken = generateRandomToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    // El envío del email queda como integración pendiente. El token raw
    // está disponible para el adaptador de email.
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestError(ERRORS.PASSWORD_RESET_INVALID);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
