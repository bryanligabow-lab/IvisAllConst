# Build context: repo root (Railway "Root Directory" = "/").
FROM node:20-alpine AS base
WORKDIR /app

# ---------- Dependencias ----------
FROM base AS deps
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=production
# El URL del API se inyecta en build-time como variable pública NEXT_PUBLIC_*.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY frontend .
RUN npm run build

# ---------- Producción ----------
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
# Next.js standalone respeta la variable PORT que inyecta Railway.
CMD ["node", "server.js"]
