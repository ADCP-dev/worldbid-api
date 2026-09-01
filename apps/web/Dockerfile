# WorldBid 3D frontend — Astro static build.
# Build context = repo ROOT (Coolify). El .dockerignore efectivo es el de la raíz,
# así que movemos node_modules fuera del árbol para que COPY apps/web no lo pise.
FROM node:22-alpine

WORKDIR /app/apps/web

COPY apps/web/package.json ./package.json
COPY apps/web/package-lock.json* ./
RUN npm install --include=dev

# Copiar el resto del paquete SIN node_modules: primero mover el instalado fuera
RUN mv node_modules /tmp/wb_node_modules
COPY apps/web ./
RUN rm -rf node_modules && mv /tmp/wb_node_modules node_modules

ARG PUBLIC_WORLDBID_API_URL
ENV PUBLIC_WORLDBID_API_URL=$PUBLIC_WORLDBID_API_URL
RUN npm run build

RUN npm install -g serve@14
EXPOSE 4321
CMD ["npx", "serve", "-l", "4321", "-s", "./dist"]
