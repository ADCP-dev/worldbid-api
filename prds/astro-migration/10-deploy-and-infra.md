---
doc: astro-migration/10-deploy-and-infra
title: "Deploy e Infraestructura"
status: draft
created: 2026-07-07
updated: 2026-07-07
---

# Deploy e Infraestructura

## Topología: deploy dual + triple runtime

```
                    ┌─────────────────────────┐
                    │   Usuario / Cliente     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Reverse Proxy (Nginx) │
                    │   (gestionado por Coolify)│
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
    │  Astro web       │ │  Nuxt admin    │ │  NestJS API    │
    │  Estático        │ │  Node server   │ │  Node server   │
    │  midominio.com   │ │  app.midom...  │ │  api.midom...  │
    └──────────────────┘ └────────────────┘ └────────────────┘
           Coolify            Coolify          Coolify
        (servicio estático)  (Docker container)(Docker container)
```

## Hosting por app — Coolify (Q-001)

Todas las apps se deployan via Coolify (self-hosted PaaS sobre VPS + Docker). Sin CDN externo ni edge global de terceros.

### Astro web (estático) — FR-019, FR-020

- **Coolify servicio estático** o **Docker container** sirviendo `dist/`.
- Build command: `astro build` → `dist/`. Cero Node server para web pública.
- Coolify sirve estático + Nginx reverse proxy.

### Nuxt admin (Node server)

- **Coolify Docker container** corriendo Node server.
- Mismo approach que Dockerfile actual.

### NestJS API (Node server)

- **Coolify Docker container** corriendo Node server.
- Misma infra que admin. Pueden compartir VPS o separar.

> Q-001 resuelto: Coolify self-hosted. Sin CDN externo ni agentes de terceros.

## Estrategia de dominios — Q-002 (resuelto)

Subdominios:

| App | Dominio |
|-----|---------|
| Astro web | `midominio.com` |
| Nuxt admin | `app.midominio.com` |
| NestJS API | `api.midominio.com` |

**Pros**: separación total, cookies scoped, CORS claro, deploy independiente.
**Contras**: DNS + certs por subdominio (Coolify + Let's Encrypt automatiza).

## CI/CD — pipelines separados — FR-020

| Pipeline | Trigger | Output |
|----------|---------|--------|
| `apps/web` → `astro build` | push a main + deploy hook Coolify | Deploy estático |
| `apps/front` → `nuxt build` | push a main | Deploy Node admin |
| `apps/back` → `nest build` | push a main | Deploy Node API |
| `packages/ui` | push a main | Build + version bump (internal) |

> Coolify escucha push a main o invoca deploy hook. Sin GitHub Actions obligatorio.

## Variables de entorno por app

| App | Vars |
|-----|------|
| `apps/web` | `API_URL`, `SITE_URL`, `PUBLIC_*` (build-time) |
| `apps/front` | `API_URL`, `API_PREFIX`, `NUXT_PUBLIC_*` |
| `apps/back` | `DATABASE_URL`, `JWT_SECRET`, `MAIL_*`, `STORAGE_*`, etc. |

> Astro solo expone vars `PUBLIC_*` al cliente. `API_URL` debe ser pública para islands. NFR-008: sin secrets en bundle estático.

## Nginx reverse proxy (Coolify gestionado)

Coolify gestiona Nginx reverse proxy con certs Let's Encrypt por subdominio. Equivalente a:

```nginx
server {
  server_name midominio.com;
  location / { root /var/www/astro; }  # estático
}
server {
  server_name app.midominio.com;
  location / { proxy_pass http://nuxt-admin:3000; }
}
server {
  server_name api.midominio.com;
  location / { proxy_pass http://nest-api:3001; }
}
```

> Coolify genera esto automáticamente. Sin config Nginx manual.

## CORS — NFR-009

NestJS debe permitir origen de:
- `midominio.com` (Astro islands)
- `app.midominio.com` (Nuxt admin)

Config en `apps/back/src/config/cors.config.ts` (verificar path exacto — `[NEEDS CLARIFICATION]`). Whitelist explícita, no `*`.

## Health checks

| App | Endpoint |
|-----|----------|
| NestJS | `GET /health` (o similar) — `[NEEDS CLARIFICATION]` |
| Nuxt | `GET /api/_health` (o similar) — `[NEEDS CLARIFICATION]` |
| Astro | N/A (estático) |

## Webhook rebuild CMS — FR-021 (Q-009 resuelto)

Coolify ya tiene deploy hooks listos. No implementar webhook nuevo.

```
Admin edita page en Nuxt
  → NestJS guarda en DB
  → NestJS invoca deploy hook de Coolify (POST <coolify-hook-url>)
  → Coolify re-build + deploy Astro
  → Sitio actualizado
```

> Q-009 resuelto: deploy hook existe en Coolify. NestJS solo invoca si necesita regenerar. Sin código nuevo de webhook.

Fallback si hook falla (R8): cron build cada N horas + dashboard admin muestra "último deploy".

## Riesgos (ver `05-risks-and-tradeoffs.md`)

| Riesgo | Mitigación |
|--------|------------|
| R3 Build acoplado backend | CI tolera backend down, fallback estático |
| R4 Contenido stale | Deploy hook Coolify + cron fallback |
| R8 Webhook no fire | Cron + monitor último deploy |
| NFR-009 CORS mal configurado | Whitelist explícita, test en staging |