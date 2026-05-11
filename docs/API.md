# API — IvisAllConst

Base URL: `/api`. Todas las respuestas siguen el formato:

```json
{ "success": true, "data": {...}, "meta": {...} }
```

o, en caso de error:

```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

## Autenticación

| Método | Ruta | Body | Auth | Descripción |
|--------|------|------|------|-------------|
| POST | `/auth/register` | `{ email, password, firstName, lastName }` | no | Crear cuenta |
| POST | `/auth/login` | `{ email, password }` | no | Inicia sesión, devuelve `accessToken` y setea cookie `refresh_token` HttpOnly |
| POST | `/auth/refresh` | (cookie) | no | Rota tokens |
| POST | `/auth/logout` | (cookie) | no | Revoca refresh token |
| GET  | `/auth/me` | — | sí | Usuario actual |
| POST | `/auth/forgot-password` | `{ email }` | no | Solicita reset |
| POST | `/auth/reset-password` | `{ token, password }` | no | Restablece contraseña |

## Proyectos

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET    | `/projects` | `projects.read` | Lista (paginada) |
| POST   | `/projects` | `projects.create` | Crear |
| GET    | `/projects/:id` | `projects.read` | Detalle |
| GET    | `/projects/:id/summary` | `projects.read` | Resumen presupuesto / saldos |
| PATCH  | `/projects/:id` | `projects.update` | Actualizar |
| DELETE | `/projects/:id` | `projects.delete` | Soft delete |

## Rubros

| Método | Ruta | Permiso |
|--------|------|---------|
| GET    | `/rubros?projectId=...` | `rubros.read` |
| POST   | `/rubros` | `rubros.write` |
| PATCH  | `/rubros/:id` | `rubros.write` |
| DELETE | `/rubros/:id` | `rubros.write` |

## Gastos

| Método | Ruta | Permiso |
|--------|------|---------|
| GET    | `/gastos?projectId=&rubroId=&page=&perPage=` | `gastos.read` |
| POST   | `/gastos` | `gastos.write` |
| PATCH  | `/gastos/:id` | `gastos.write` |
| DELETE | `/gastos/:id` | `gastos.write` |

Crear gasto requiere `projectId`, `rubroId`, `description`, `amount`, `gastoDate`.

## Planillas

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET    | `/planillas?projectId=...` | `planillas.read` | Listar |
| GET    | `/planillas/:id` | `planillas.read` | Detalle con items |
| POST   | `/planillas` | `planillas.write` | Crear (calcula amortización + garantía) |
| PATCH  | `/planillas/:id/status` | `planillas.write` | Cambiar status (DRAFT → SUBMITTED → APPROVED → PAID) |
| DELETE | `/planillas/:id` | `planillas.write` | Soft delete |
| GET    | `/planillas/:id/export` | `planillas.export` | Descarga Excel |

Body al crear planilla:

```json
{
  "projectId": "uuid",
  "title": "Planilla #1",
  "periodStart": "2025-10-16",
  "periodEnd": "2025-11-15",
  "items": [
    { "rubroId": "uuid", "executedQuantity": 79.36, "currentAmount": 1244 }
  ]
}
```

## Health

`GET /api/health` → estado de Postgres y Redis.

## Códigos de error

| Code | Status | Significado |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Sin sesión |
| `FORBIDDEN` | 403 | Sin permisos |
| `NOT_FOUND` | 404 | Recurso no existe |
| `CONFLICT` | 409 | Duplicado |
| `VALIDATION_ERROR` | 422 | Body inválido |
| `TOO_MANY_REQUESTS` | 429 | Rate limit |
| `INTERNAL_ERROR` | 500 | Error no controlado |
