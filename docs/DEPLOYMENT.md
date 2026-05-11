# Despliegue — IvisAllConst

## Desarrollo local

```bash
cp .env.example .env
docker compose up --build
```

## Producción

### Pre-requisitos

- Servidor con Docker Engine 24+ y Docker Compose v2.
- Dominios apuntando al servidor (DNS A/AAAA).
- Certificados TLS (Let's Encrypt o equivalente).
- Reverse proxy delante (Caddy / Traefik / Nginx) que termine TLS.

### Pasos

1. Clonar el repo en el servidor.
2. Crear `.env` con secretos generados aleatoriamente (≥ 64 chars para
   `JWT_*_SECRET`).
3. Construir y levantar:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

4. Las migraciones corren automáticamente; verificar con
   `docker compose logs backend`.
5. Configurar el reverse proxy:
   - `app.ejemplo.com` → frontend (puerto 3000).
   - `api.ejemplo.com` → backend (puerto 4000).
6. Configurar `CORS_ORIGIN=https://app.ejemplo.com` y
   `NEXT_PUBLIC_API_URL=https://api.ejemplo.com/api`.

### Backups

```bash
# manual
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup-$(date +%F).sql.gz
```

Sugerencia: cron en el host que ejecute el script y lo suba a S3/R2.

### Rollback

1. `docker compose down` (mantiene volúmenes).
2. Volver a la imagen anterior (`git checkout <tag>` o pull de la imagen
   etiquetada).
3. Restaurar BD si una migración nueva rompió:
   ```bash
   gunzip -c backup-<fecha>.sql.gz | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
   ```
4. `docker compose up -d --build`.

## Monitoreo

- `/api/health` debe responder 200; configurar alertas si falla 3 veces.
- Recopilar logs (JSON en producción) en un agregador (Loki, ELK, Datadog).
