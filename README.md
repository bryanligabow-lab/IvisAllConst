# IvisAllConst — Sistema de Gestión de Proyectos de Construcción

Sistema full-stack para control de proyectos de construcción: presupuestos por rubros, registro de gastos con descuento automático, generación de planillas de avance con amortización de anticipo y fondo de garantía, y exportación a Excel.

> **Deploy en línea:** ver [`DEPLOY-RAILWAY.md`](./DEPLOY-RAILWAY.md) para desplegar todo (frontend + backend + Postgres) en Railway en ~10 minutos.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL 16 + Prisma ORM
- **Cache**: Redis 7
- **Auth**: JWT (access + refresh con rotación)
- **Contenedores**: Docker Compose

## Requisitos previos

- Docker 24+ y Docker Compose v2
- Node.js 20+ (solo si vas a correr fuera de Docker)
- pnpm 9+ o npm 10+

## Inicio rápido

```bash
git clone <repo-url> ivisallconst
cd ivisallconst
cp .env.example .env
docker compose up --build
```

Esto levanta:

| Servicio  | URL                       |
|-----------|---------------------------|
| Frontend  | http://localhost:3000     |
| Backend   | http://localhost:4000     |
| Health    | http://localhost:4000/api/health |
| Postgres  | localhost:5432            |
| Redis     | localhost:6379            |

Las migraciones y el seed se ejecutan automáticamente. El usuario admin por defecto es `admin@ivisallconst.local` / `Admin123!` (cámbialo en producción).

## Estructura

```
ivisallconst/
├── backend/         # API Express + TypeScript
├── frontend/        # Next.js 14 App Router
├── database/        # Esquema Prisma, migraciones, seed
├── docker-compose.yml
├── .env.example
└── docs/            # API, arquitectura, deploy, seguridad
```

## Comandos útiles

```bash
# Logs de un servicio
docker compose logs -f backend

# Migrar la BD manualmente
docker compose exec backend npx prisma migrate deploy

# Reset completo (¡borra datos!)
docker compose down -v && docker compose up --build

# Correr tests
docker compose exec backend npm test
docker compose exec frontend npm test
```

## Documentación

- [`docs/API.md`](docs/API.md) — Endpoints
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Diagrama de arquitectura
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Despliegue
- [`docs/SECURITY.md`](docs/SECURITY.md) — Políticas de seguridad

## Licencia

Propietario — todos los derechos reservados.
