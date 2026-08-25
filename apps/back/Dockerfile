# syntax=docker/dockerfile:1.7

# ============================================================================
# Stage 1: deps — install ALL deps (prod + dev) with pnpm + BuildKit cache
# ============================================================================
FROM node:22-alpine AS deps

WORKDIR /usr/src/app

RUN apk add --no-cache git \
    && corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy manifests first → this layer is cached unless package*.json change.
COPY package.json pnpm-lock.yaml* ./

# Force devDependencies inclusion: @nestjs/cli (nest) is needed for build.
# Coolify injects NODE_ENV=production at build time, which makes pnpm skip
# devDependencies unless we explicitly set NODE_ENV=development.
# pnpm store cached between builds via BuildKit mount.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_ENV=development pnpm install --no-frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# ============================================================================
# Stage 2: build — compile TypeScript to dist/
# ============================================================================
FROM node:22-alpine AS build

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Reuse the installed node_modules from the deps stage.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the rest of the source.
COPY . .

# Config loaders expect .env to exist at build time.
RUN echo "" > .env

# Compile: nest build → dist/
RUN pnpm run build

# ============================================================================
# Stage 3: prod — runtime with dist/ + node_modules reused from deps stage
# ============================================================================
FROM node:22-alpine AS prod

RUN apk add --no-cache bash git \
    ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Reuse the already-installed node_modules from the deps stage.
# We keep devDependencies to avoid pnpm prune issues with ambiguous lockfile
# entries (e.g. js-yaml). The image is larger but stable and deterministic
# per commit.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy manifests so package metadata is available.
COPY package.json ./

# Copy the compiled output from the build stage.
COPY --from=build /usr/src/app/dist ./dist

# Copy startup script.
COPY startup.sh /opt/startup.sh
RUN chmod +x /opt/startup.sh && sed -i 's/\r//g' /opt/startup.sh

# Empty .env — runtime config comes from Coolify env vars.
RUN echo "" > .env

EXPOSE 3000

CMD ["/opt/startup.sh"]