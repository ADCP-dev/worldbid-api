# Build Stage
# Build context: apps/front/ (as set in Coolify)
# This Dockerfile works standalone — no monorepo workspace files needed
# since apps/front has zero local workspace dependencies.

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# Copy manifests first to leverage Docker layer caching for deps.
COPY package.json pnpm-lock.yaml* ./

# Install deps with pnpm store cached between builds via BuildKit mount.
# Force devDependencies: @nuxt/cli and build tools are dev-only.
# Coolify injects NODE_ENV=production at build time, which skips devDeps.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_ENV=development pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Copy the rest of the source (needed for nuxt prepare postinstall + build).
COPY . ./

# If postinstall didn't run (no lockfile change), run nuxt prepare now.
RUN pnpm run postinstall || true

# Build the Nuxt SPA → outputs .output/
RUN pnpm run build

# Production Stage — slim static server
FROM node:22-alpine AS prod
WORKDIR /app

COPY --from=build /app/.output/ ./

ENV PORT=80
ENV HOST=0.0.0.0

EXPOSE 80

CMD ["node", "/app/server/index.mjs"]