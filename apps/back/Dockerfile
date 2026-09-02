# syntax=docker/dockerfile:1.7

# ============================================================================
# WorldBid API — NestJS backend (Foundation fork, worldbid module)
# Build context = repo root (needs apps/back + packages/emails)
# ============================================================================

# ---- Stage 1: deps — ALL deps with pnpm + BuildKit cache ----
FROM node:22-alpine AS deps

WORKDIR /usr/src/app

RUN apk add --no-cache git \
    && corepack enable && corepack prepare pnpm@9.0.0 --activate

# Monorepo manifests for the workspace the backend depends on
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/back/package.json apps/back/package.json
COPY packages/emails/package.json packages/emails/package.json

# devDependencies needed (nest build); BuildKit store cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_ENV=development pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# ---- Stage 2: build — nest build → dist/ ----
FROM node:22-alpine AS build

WORKDIR /usr/src/app

RUN apk add --no-cache git \
    && corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/apps/back/node_modules ./apps/back/node_modules
COPY --from=deps /usr/src/app/packages/emails/node_modules ./packages/emails/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/back ./apps/back
COPY packages/emails ./packages/emails

RUN echo "" > apps/back/.env
WORKDIR /usr/src/app/apps/back
RUN pnpm run build

# ---- Stage 3: prod runtime ----
FROM node:22-alpine AS prod

RUN apk add --no-cache bash git

ENV NODE_ENV=production
WORKDIR /usr/src/app

# El paquete back trae SU node_modules (typeorm, nest, etc.) — el de la raíz
# del workspace es de turbo/eslint y NO tiene las deps de runtime.
COPY --from=build /usr/src/app/apps/back/node_modules ./node_modules
COPY apps/back/package.json ./
COPY --from=build /usr/src/app/apps/back/dist ./dist
COPY apps/back/startup.sh /opt/startup.sh
RUN chmod +x /opt/startup.sh && sed -i 's/\r//g' /opt/startup.sh

RUN echo "" > .env

EXPOSE 3000

CMD ["/opt/startup.sh"]