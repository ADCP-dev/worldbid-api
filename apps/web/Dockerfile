# Astro public web app — static output served by nginx (Coolify).
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
FROM nginx:alpine AS prod

# Configure nginx to listen on port 4321.
RUN sed -i 's/listen       80;/listen       4321;/' /etc/nginx/conf.d/default.conf \
    && sed -i 's/listen  \[::\]:80;/listen  [::]:4321;/' /etc/nginx/conf.d/default.conf

# Remove default nginx index files and copy the built static output.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/ /usr/share/nginx/html/

# SPA fallback: serve index.html for client-side routes.
RUN echo 'location / { try_files $uri $uri/ /index.html; }' > /etc/nginx/conf.d/spa.conf

EXPOSE 4321
CMD ["nginx", "-g", "daemon off;"]