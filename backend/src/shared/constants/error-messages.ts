export const ERRORS = {
  // Auth
  UNAUTHORIZED: 'No autenticado',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  ACCOUNT_INACTIVE: 'Cuenta desactivada',
  TOO_MANY_LOGIN_ATTEMPTS: 'Demasiados intentos fallidos. Intenta de nuevo en 30 min.',
  ACCESS_TOKEN_MISSING: 'Token de acceso ausente',
  ACCESS_TOKEN_INVALID: 'Token de acceso inválido o expirado',
  REFRESH_TOKEN_MISSING: 'Refresh token ausente',
  REFRESH_TOKEN_INVALID: 'Refresh token inválido',
  SESSION_EXPIRED: 'Sesión expirada o revocada',
  PERMISSION_REQUIRED: (perms: string) => `Permiso requerido: ${perms}`,
  ROLE_REQUIRED: (roles: string) => `Rol requerido: ${roles}`,
  PASSWORD_RESET_INVALID: 'Token inválido o expirado',

  // Genéricos
  NOT_FOUND: 'Recurso no encontrado',
  CONFLICT_DUPLICATE: 'Registro duplicado',
  VALIDATION_FAILED: 'Datos inválidos',
  INTERNAL: 'Error interno del servidor',
  TOO_MANY_REQUESTS: 'Demasiadas peticiones, intenta de nuevo más tarde.',

  // Dominio
  EMAIL_ALREADY_REGISTERED: 'Ya existe una cuenta con ese email',
  USER_INVALID: 'Usuario no válido',
  PROJECT_NOT_FOUND: 'Proyecto no encontrado',
  RUBRO_NOT_FOUND: 'Rubro no encontrado',
  RUBRO_NOT_IN_PROJECT: 'Rubro no encontrado para este proyecto',
  GASTO_NOT_FOUND: 'Gasto no encontrado',
  PLANILLA_NOT_FOUND: 'Planilla no encontrada',
} as const;

export const SUCCESS = {
  ACCOUNT_CREATED: 'Cuenta creada. Revisa tu email para verificarla.',
  PASSWORD_UPDATED: 'Contraseña actualizada',
  PASSWORD_RESET_INSTRUCTIONS: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
  LOGGED_OUT: 'Sesión cerrada',
  PROJECT_DELETED: 'Proyecto eliminado',
  RUBRO_DELETED: 'Rubro eliminado',
  GASTO_DELETED: 'Gasto eliminado',
  PLANILLA_DELETED: 'Planilla eliminada',
} as const;
