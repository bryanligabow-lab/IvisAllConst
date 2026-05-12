#!/bin/sh
set -e

echo "🔄 Sincronizando esquema con Postgres..."
npx prisma db push --schema=/database/prisma/schema.prisma --skip-generate --accept-data-loss

echo "🌱 Aplicando seed (idempotente)..."
npx tsx /database/prisma/seed.ts || echo "⚠️  Seed falló (puede ser normal si ya estaba aplicado)"

if [ "$RUN_CLEANUP" = "1" ]; then
  echo "🧹 RUN_CLEANUP=1 detected — running cleanup-demo-data.ts..."
  npx tsx /app/scripts/cleanup-demo-data.ts || echo "⚠️  Cleanup falló"
fi

echo "🚀 Iniciando API..."
exec node dist/index.js
