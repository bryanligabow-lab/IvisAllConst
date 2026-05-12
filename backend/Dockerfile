# Build context: repo root (Railway "Root Directory" debe quedar en "/").
# Layout copiado a la imagen:
#   /app          → backend
#   /database     → schema Prisma + seed
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---------- Dependencias ----------
FROM base AS deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY database/package.json /database/package.json
RUN cd /database && npm install --no-audit --no-fund

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /database/node_modules /database/node_modules
COPY database /database
COPY backend .
RUN npx prisma generate --schema=/database/prisma/schema.prisma
# Sync generated client into /app/node_modules so backend can `import '@prisma/client'`.
RUN rm -rf /app/node_modules/.prisma /app/node_modules/@prisma/client \
 && cp -r /database/node_modules/.prisma /app/node_modules/.prisma \
 && cp -r /database/node_modules/@prisma/client /app/node_modules/@prisma/client
RUN npm run build

# ---------- Producción ----------
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets
COPY --from=builder /database /database
COPY backend/package.json ./
COPY backend/scripts /app/scripts
COPY backend/scripts/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/start.sh"]
