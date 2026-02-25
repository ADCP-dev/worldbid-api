FROM node:22.15.0-alpine AS build

WORKDIR /app
COPY pnpm-lock.yaml package.json ./

# Enable corepack for pnpm support
RUN corepack enable
RUN pnpm install --frozen-lockfile --prod

COPY . .
RUN pnpm run build

FROM node:22.15.0-alpine AS final
WORKDIR /app
COPY --from=build /app/.output .output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
