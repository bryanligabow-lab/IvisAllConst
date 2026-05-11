export const REGEX = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  PASSWORD_UPPERCASE: /[A-Z]/,
  PASSWORD_DIGIT: /[0-9]/,
  PASSWORD_SPECIAL: /[^A-Za-z0-9]/,
  TTL: /^(\d+)([smhd])$/,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
