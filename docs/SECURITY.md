# Seguridad — IvisAllConst

## Implementado

- **Headers**: helmet (CSP en producción, HSTS, X-Content-Type-Options, etc.)
- **CORS**: lista blanca por env (`CORS_ORIGIN`).
- **Rate limiting** por IP (Redis): general 100/min, login 5/15min,
  registro 3/h, password reset 3/h, uploads 10/h.
- **Hashing**: bcrypt con cost 12 (configurable).
- **JWT**: access 15min en memoria de frontend; refresh 7d en cookie
  HttpOnly + Secure + SameSite=Lax con rotación.
- **Bloqueo por intentos fallidos**: 5 fallos en 15 min → bloqueo 30 min.
- **Validación de entrada**: zod en cada endpoint, sin confiar en frontend.
- **Soft delete**: `deletedAt` en tablas críticas.
- **Auditoría**: tabla `audit_logs` (lista para hookear desde services).
- **Variables de entorno**: validadas con zod al arrancar; el server no
  arranca si falta alguna.
- **Respuestas de error**: stack traces sólo en desarrollo.
- **Graceful shutdown** y timeouts.

## Pendiente / Próximos pasos

- Envío real de email para verificación y reset.
- 2FA (TOTP) para roles administrativos.
- Sweeps periódicos para limpiar refresh tokens expirados.
- WAF / reverse proxy con TLS terminator delante.
- Backups automáticos de Postgres a S3 (script provisto en
  `database/backups/`).

## Reportar vulnerabilidades

Envía un correo a `security@ivisallconst.local` con el detalle técnico
y, si es posible, una prueba de concepto. No divulgues públicamente
hasta tener parche disponible.
