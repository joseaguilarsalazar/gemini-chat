# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- build
FROM node:24-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 es un módulo nativo: si no hay binario precompilado,
# necesita compilar. Estas herramientas quedan solo en la etapa de build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------- runtime
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/app/data/chat.db

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY public ./public

# El usuario `node` ya existe en la imagen oficial (uid 1000).
# /app/data se monta como volumen; el directorio se crea con su dueño.
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
