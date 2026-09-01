# WorldBid 3D frontend — Astro static build (Coolify).
# Build context = apps/web/ (self-contained; no monorepo workspace deps).
# The API base URL is baked at build time via PUBLIC_WORLDBID_API_URL.

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml* ./
# Astro build tools are dev-only; force them in (Coolify sets NODE_ENV=production).
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_ENV=development pnpm install --no-frozen-lockfile

COPY . .
# ARG → env at build time so the bundle embeds the public API URL.
ARG PUBLIC_WORLDBID_API_URL
ENV PUBLIC_WORLDBID_API_URL=$PUBLIC_WORLDBID_API_URL
RUN pnpm run build

# ---- Prod stage: static serve via Node ----
FROM node:22-alpine AS prod
WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

ENV PORT=4321
EXPOSE 4321
CMD ["npx", "serve", "-l", "4321", "-s", "./dist"]