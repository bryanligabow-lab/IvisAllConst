# Deploy en Railway — paso a paso

Tiempo estimado: **10 minutos**. Una sola cuenta (login con GitHub). Tres servicios en el mismo proyecto: Postgres + Backend + Frontend.

## 1) Crear el proyecto

1. Entra a https://railway.com/new (login con GitHub si te lo pide).
2. **"Deploy from GitHub repo"** → elige `IvisAllConst`.
3. Railway empezará a desplegar el primer servicio. Cancélalo de momento (lo configuraremos como backend).

## 2) Añadir Postgres

1. Dentro del proyecto: botón **"+ New"** (arriba a la derecha) → **"Database"** → **"Add PostgreSQL"**.
2. Espera 30s a que arranque. Ya tienes una variable `DATABASE_URL` disponible para los otros servicios.

## 3) Servicio Backend

1. **"+ New"** → **"GitHub Repo"** → el mismo repo `IvisAllConst`.
2. En el servicio creado → pestaña **"Settings"**:
   - **Root Directory**: `/` (la raíz del repo)
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Service Name**: `backend`
3. Pestaña **"Variables"** → añade estas variables (puedes pegarlas todas con "Raw Editor"):

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=cambia-esto-por-32-caracteres-aleatorios-seguros-AAAAA
JWT_REFRESH_SECRET=cambia-esto-por-32-caracteres-aleatorios-seguros-BBBBB
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_COST=10
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
LOG_LEVEL=info
SEED_ADMIN_EMAIL=admin@ivisallconst.local
SEED_ADMIN_PASSWORD=Admin123!
SEED_ADMIN_FIRST_NAME=Admin
SEED_ADMIN_LAST_NAME=IvisAllConst
```

> 💡 `${{Postgres.DATABASE_URL}}` lo resuelve Railway automáticamente — no escribas tú la URL.

4. Pestaña **"Settings"** → **"Networking"** → **"Generate Domain"**. Te dará algo como `backend-production-xxxx.up.railway.app`. **Guarda esa URL**, la usaremos en el frontend.

## 4) Servicio Frontend

1. **"+ New"** → **"GitHub Repo"** → mismo repo.
2. **"Settings"**:
   - **Root Directory**: `/`
   - **Dockerfile Path**: `frontend/Dockerfile`
   - **Service Name**: `frontend`
3. **"Variables"**:

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://TU-URL-BACKEND-DE-RAILWAY.up.railway.app/api
```

> Sustituye `TU-URL-BACKEND-DE-RAILWAY` por la URL que generó el backend (paso 3.4) y añade `/api` al final.

4. Pestaña **"Settings"** → **"Generate Domain"** → esa será **la URL que le pasarás a la otra persona**.

## 5) Volver a CORS_ORIGIN en el backend

Ahora que tienes la URL del frontend, regresa al servicio **backend** → **"Variables"** → cambia:

```env
CORS_ORIGIN=https://TU-URL-FRONTEND.up.railway.app
```

Railway redeploya el backend automáticamente.

## 6) Listo

Abre la URL del **frontend** → entra con:

- **Email:** `admin@ivisallconst.local`
- **Contraseña:** `Admin123!`

Verás 3 proyectos demo con gastos y una planilla aprobada. Le mandas la URL del frontend a quien quieras y ven exactamente lo mismo que tú.

## Notas

- El backend corre `prisma db push` + seed en cada arranque (idempotente, no duplica datos).
- Si quieres resetear los datos: en Railway → Postgres → **"Data"** → **"Reset Database"**, luego redeploy del backend.
- Los logs de cada servicio están en su pestaña **"Deployments"** → click en el deploy activo.
