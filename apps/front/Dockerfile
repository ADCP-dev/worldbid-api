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

# Build the Nuxt SPA → outputs .output/public/
RUN pnpm run build

# Production Stage — nginx serving static SPA
FROM nginx:alpine AS prod

# Configure nginx: listen on 3000, relative redirects (preserve HTTPS),
# and SPA fallback (try_files index.html for client-side routes).
# Replace the entire default.conf with a minimal SPA server config.
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINXEOF'
server {
    listen       3000;
    listen  [::]:3000;
    server_name  localhost;
    port_in_redirect off;
    absolute_redirect off;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
NGINXEOF

# Remove default nginx index files and copy the built static output.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/.output/public/ /usr/share/nginx/html/

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]