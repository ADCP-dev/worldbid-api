# Astro public web app — SSR standalone Node server (Coolify).
# Build context = apps/web/ (no monorepo workspace deps needed).

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml* ./
# Force devDependencies: Astro build tools (astro CLI, @astrojs/*) are dev-only.
# Coolify injects NODE_ENV=production at build time, which skips devDeps.
# pnpm store cached between builds via BuildKit mount.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_ENV=development pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm run build

# ---- Prod stage ----
FROM node:22-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]