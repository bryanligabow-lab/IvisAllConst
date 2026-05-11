#!/bin/sh
set -e

echo "🔄 Sincronizando esquema con Postgres..."
npx prisma db push --schema=/database/prisma/schema.prisma --skip-generate --accept-data-loss

echo "🌱 Aplicando seed (idempotente)..."
npx tsx /database/prisma/seed.ts || echo "⚠️  Seed falló (puede ser normal si ya estaba aplicado)"

echo "🚀 Iniciando API..."
exec node dist/index.js
