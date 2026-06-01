import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { prisma } from '../../config/database';
import { success } from '../../utils/apiResponse';
import { UnauthorizedError } from '../../utils/errors';
import { env } from '../../config/env';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
} from '../../shared/constants/auth.constants';
import { ERRORS, SUCCESS } from '../../shared/constants/error-messages';
import type { ISessionContext } from '../../shared/interfaces/auth.interface';

function setRefreshCookie(res: Response, token: string, maxAgeSec: number): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSec * 1000,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function getCtx(req: Request): ISessionContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export class AuthController {
  static async register(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.register(req.body);
    return success(res, { ...result, message: SUCCESS.ACCOUNT_CREATED }, 201);
  }

  static async login(req: Request, res: Response): Promise<Response> {
    const { accessToken, refreshToken, accessExpiresInSec, refreshExpiresInSec, userId } =
      await AuthService.login(req.body, getCtx(req));

    setRefreshCookie(res, refreshToken, refreshExpiresInSec);
    return success(res, { accessToken, expiresIn: accessExpiresInSec, userId });
  }

  static async refresh(req: Request, res: Response): Promise<Response> {
    const refreshToken: string | undefined =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    if (!refreshToken) throw new UnauthorizedError(ERRORS.REFRESH_TOKEN_MISSING);

    const tokens = await AuthService.refresh(refreshToken, getCtx(req));
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresInSec);

    return success(res, {
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessExpiresInSec,
    });
  }

  static async logout(req: Request, res: Response): Promise<Response> {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];
    await AuthService.logout(refreshToken);
    clearRefreshCookie(res);
    return success(res, { message: SUCCESS.LOGGED_OUT });
  }

  static async me(req: Request, res: Response): Promise<Response> {
    if (!req.user) throw new UnauthorizedError();
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId: req.user.id },
      select: { projectId: true },
    });
    return success(res, { ...req.user, projectIds: assignments.map((a) => a.projectId) });
  }

  static async forgotPassword(req: Request, res: Response): Promise<Response> {
    await AuthService.forgotPassword(req.body.email);
    return success(res, { message: SUCCESS.PASSWORD_RESET_INSTRUCTIONS });
  }

  static async resetPassword(req: Request, res: Response): Promise<Response> {
    await AuthService.resetPassword(req.body.token, req.body.password);
    return success(res, { message: SUCCESS.PASSWORD_UPDATED });
  }
}
