# Build Stage
# Build context: apps/front/ (as set in Coolify)
# This Dockerfile works standalone — no monorepo workspace files needed
# since apps/front has zero local workspace dependencies.

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# Copy everything (context = apps/front/)
COPY . ./

# Install deps (postinstall runs `nuxt prepare`, needs source → COPY first)
# pnpm 11+ requires approving build scripts — allow all for build env
# Force devDependencies: @nuxt/cli and build tools are dev-only.
# Coolify injects NODE_ENV=production at build time, which skips devDeps.
RUN NODE_ENV=development pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Build the Nuxt app → outputs .output/
RUN pnpm run build

# Production Stage
FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/.output/ ./

ENV PORT=80
ENV HOST=0.0.0.0

EXPOSE 80

CMD ["node", "/app/server/index.mjs"]
