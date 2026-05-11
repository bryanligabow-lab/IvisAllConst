import { z } from 'zod';
import { REGEX, PASSWORD_MIN_LENGTH } from '../../shared/constants/regex.constants';

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .regex(REGEX.PASSWORD_UPPERCASE, 'Debe contener al menos una mayúscula')
  .regex(REGEX.PASSWORD_DIGIT, 'Debe contener al menos un número')
  .regex(REGEX.PASSWORD_SPECIAL, 'Debe contener al menos un carácter especial');

export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
