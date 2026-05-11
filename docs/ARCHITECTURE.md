# Arquitectura — IvisAllConst

## Visión general

```
┌──────────────┐        HTTPS         ┌──────────────┐
│  Frontend    │ ───────────────────► │   Backend    │
│  Next.js 14  │   Bearer + Cookie    │  Express API │
│  (App Router)│                      │  TypeScript  │
└──────────────┘                      └──────┬───────┘
                                             │
                          ┌──────────────────┼──────────────┐
                          ▼                  ▼              ▼
                   ┌─────────────┐   ┌────────────┐  ┌──────────────┐
                   │  Postgres   │   │   Redis    │  │  Storage S3  │
                   │  (Prisma)   │   │  rate limit│  │   futuro     │
                   └─────────────┘   └────────────┘  └──────────────┘
```

## Capas backend

- **Routes** — entrada HTTP, sólo registran controladores con sus middlewares.
- **Controllers** — extraen request, delegan al service y formatean respuesta.
- **Services** — lógica de negocio. Únicos que tocan Prisma.
- **Middleware** — auth, rate limit, validación, error handler, logger.
- **Shared** — constantes (mensajes, roles, permisos, rate limits), interfaces,
  utilidades (hash, token), DTOs reutilizables.

## Patrones

- **RBAC**: roles → permisos. Cada endpoint declara `requirePermission(...)`.
- **JWT con rotación**: access token (memoria del frontend, 15 min) y refresh
  token (cookie HttpOnly Secure, 7 días). Cada refresh emite nuevo par y revoca
  el anterior.
- **Soft delete**: `deletedAt` en tablas críticas. Las queries filtran por
  `deletedAt: null`.
- **Auditoría**: tabla `audit_logs` lista para registrar create/update/delete
  (hook en services).
- **Cálculo de planillas**: el service computa amortización de anticipo
  (% del anticipo aplicado sobre la planilla) y fondo de garantía retenido.
  Estos valores se persisten en la propia planilla para reproducibilidad.

## Frontend

- **App Router** (Next.js 14) con páginas client-side para vistas autenticadas.
- **SWR** para fetching con cache.
- **Zustand** para estado de auth en cliente.
- **Tailwind** con tokens semánticos (`brand`, `ink`, `surface`, etc.).
- El access token vive en `sessionStorage`. Al recibir 401, el cliente hace
  refresh automático y reintenta una vez.

## Despliegue

- **Docker Compose** levanta Postgres, Redis, backend y frontend.
- Migraciones y seed corren al arrancar el backend.
- Imágenes Docker multi-stage; la imagen final de backend usa `tini` para
  manejo correcto de señales.
