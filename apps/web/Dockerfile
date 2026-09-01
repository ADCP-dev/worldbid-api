# WorldBid 3D frontend — Astro static build.
# Build context = repo ROOT (Coolify). Todo el build corre dentro de apps/web.
FROM node:22-alpine

WORKDIR /app/apps/web

# Instalar deps del paquete (usa package-lock del paquete si existe; si no, npm resuelve)
COPY apps/web/package.json ./package.json
COPY apps/web/package-lock.json* ./
RUN npm install --include=dev

# Copiar el resto del paquete y buildar
COPY apps/web ./
ARG PUBLIC_WORLDBID_API_URL
ENV PUBLIC_WORLDBID_API_URL=$PUBLIC_WORLDBID_API_URL
RUN npm run build

# Servir estático
RUN npm install -g serve@14
EXPOSE 4321
CMD ["npx", "serve", "-l", "4321", "-s", "./dist"]
