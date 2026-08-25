# syntax=docker/dockerfile:1.7

# ============================================================================
# Stage 1: deps — install ALL deps (prod + dev) in a cached layer
# ============================================================================
FROM node:22.16.0-alpine AS deps

WORKDIR /usr/src/app

# git needed by some npm packages that resolve from git repos
RUN apk add --no-cache git

# Copy only manifests first → this layer is cached unless package*.json change.
COPY package.json package-lock.json ./

# npm install (not ci: lockfile may have drift)
# Force devDependencies inclusion: @nestjs/cli (nest) is needed for build.
# Coolify injects NODE_ENV=production at build time, which makes npm skip
# devDependencies unless we explicitly request them.
# npm cache reused between builds via BuildKit mount.
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --no-audit --no-fund --include=dev

# ============================================================================
# Stage 2: build — compile TypeScript to dist/
# ============================================================================
FROM node:22.16.0-alpine AS build

WORKDIR /usr/src/app

# Reuse the installed node_modules from the deps stage.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy the rest of the source.
COPY . .

# Config loaders expect .env to exist at build time.
RUN echo "" > .env

# Compile: nest build → dist/
RUN npm run build

# ============================================================================
# Stage 3: prod — slim runtime with dist/ + prod-only node_modules
# ============================================================================
FROM node:22.16.0-alpine AS prod

RUN apk add --no-cache bash git \
    ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install ONLY production dependencies (no devDeps, no prune needed).
# This avoids the npm prune bug where it removes needed packages
# (e.g., js-yaml) that have duplicate versions in the lockfile.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund

# Copy the compiled output from the build stage.
COPY --from=build /usr/src/app/dist ./dist

# Copy startup script.
COPY startup.sh /opt/startup.sh
RUN chmod +x /opt/startup.sh && sed -i 's/\r//g' /opt/startup.sh

# Empty .env — runtime config comes from Coolify env vars.
RUN echo "" > .env

EXPOSE 3000

CMD ["/opt/startup.sh"]