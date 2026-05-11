import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(AuthController.register),
);

authRouter.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(AuthController.login),
);

authRouter.post('/refresh', asyncHandler(AuthController.refresh));

authRouter.post('/logout', asyncHandler(AuthController.logout));

authRouter.get('/me', authenticate, asyncHandler(AuthController.me));

authRouter.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword),
);

authRouter.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword),
);
