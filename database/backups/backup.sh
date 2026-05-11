#!/usr/bin/env bash
# Backup diario comprimido de Postgres.
# Uso: ./backup.sh   (lee variables del .env del proyecto)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck disable=SC1091
[ -f "$ROOT_DIR/.env" ] && source "$ROOT_DIR/.env"

: "${POSTGRES_USER:?POSTGRES_USER no definido}"
: "${POSTGRES_DB:?POSTGRES_DB no definido}"
: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$SCRIPT_DIR/files"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/ivisallconst-$TIMESTAMP.sql.gz"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner --no-privileges \
  | gzip -9 > "$OUT_FILE"

# Retención: borra backups con más de 30 días
find "$OUT_DIR" -name 'ivisallconst-*.sql.gz' -mtime +30 -delete

echo "OK $OUT_FILE"
