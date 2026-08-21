---
doc: astro-public/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-08-20
---

# Riesgos y Trade-offs

## Trade-offs honestos

### Doble deploy

| Aspecto | Detalle |
|---------|---------|
| Costo | 2 pipelines (Astro SSR + Nuxt Node) + NestJS |
| Complejidad ops | Más moving parts, monitoreo múltiple |
| Beneficio | Aislamiento de fallos, deploy independiente, rollback granular |

### Doble codebase

| Aspecto | Detalle |
|---------|---------|
| Costo | Mantener 2 apps frontend (Astro + Nuxt) |
| Costo | Componentes landing reescritos (no port directo Vue→Astro) |
| Beneficio | Tools óptimas para cada naturaleza (contenido vs app) |

### Curva Astro 7

| Aspecto | Detalle |
|---------|---------|
| Costo | Equipo aprende Astro 7 (islands, build-time fetch API, ISR DIY con `Astro.cache` + `routeRules`) |
| Costo | i18n Astro menos maduro que `@nuxtjs/i18n` |
| Beneficio | Simplicidad SSR, performance, DX content, ISR DIY sin middleware custom |

### ISR DIY complexity

| Aspecto | Detalle |
|---------|---------|
| Costo | Webhook endpoint + mapa evento→tag + firma HMAC + timestamp window + manejo de errores |
| Costo | Estado de cache puede desincronizarse si webhook falla (R-ISR-2) |
| Costo | Cache NO persiste si container restartea (R-COOLIFY-1) |
| Beneficio | Revalidación granular < 60s vs full rebuild minutos |
| Beneficio | Rutas no afectadas sirven cache instantáneo |
| Beneficio | Sin Redis, sin infra extra (cache en memoria proceso Node) |

---

## Riesgos técnicos

### R2 — Consistencia visual entre apps

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Astro y Nuxt se ven distintos (sin `packages/ui` compartido, tokens drift) |
| Severidad | Media |
| Mitigación | Copiar design tokens manualmente de Nuxt a Astro (colores, tipografía, spacing). Documentar en `apps/web/README.md`. |
| Tracking | Review gate: cambios UI en Nuxt deben replicarse en Astro manual. |

### R3 — Build acoplado a backend (i18n / content fetch)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Astro build/render falla si NestJS no disponible (Modo B i18n o fetch API pages) |
| Severidad | Alta |
| Mitigación | Fallback graceful: si fetch falla, build con estático es/en + sin pages CMS. ISR webhook retry con backoff. |
| Tracking | CI debe tolerar backend down en build. NFR-007. |

### R5 — Deuda técnica landing actual

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `modules/landing/` actual (componentes Vue) se **reescribe** en Astro (no port). Posible drift funcional. |
| Severidad | Media |
| Mitigación | Fase 1 incluye smoke test visual (Astro vs Nuxt). Checklist paridad. |
| Tracking | Lighthouse + visual diff en staging. |

### R6 — Referencias residuales post-cambio

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Tras eliminar endpoints sitemap del backend, código Nuxt o backend referencia rutas removed → build rompe |
| Severidad | Baja |
| Mitigación | Grep `rg '/api/v1/sitemap' apps/front/ apps/back/` antes de eliminar endpoints backend sitemap (ver `06-migration-phases.md` Fase 2). Si Nuxt los consume, documentar como follow-up (cleanup Nuxt out-of-scope) y NO eliminar hasta coordinar. Typecheck. |
| Tracking | CI typecheck gate. |

### R10 — SEO regression en migración

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Migración cambia URLs / estructura / sitemap → pierde ranking |
| Severidad | Alta |
| Mitigación | Mismas URLs en Astro (`/blog/[slug]`, `/page/[slug]`). Redirects 301 si cambia. Sitemap consistente via `@astrojs/sitemap`. |
| Tracking | Audit SEO pre y post migración. NFR-004. |

### R-ISR-1 — Webhook spoofing (seguridad)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Attacker descubre el endpoint `/api/revalidate` y dispara purgas de cache maliciosas (DoS de cache) o inyecta payloads falsos |
| Severidad | Alta |
| Mitigación | Firma HMAC-SHA256 + timestamp + 5 min window con `REVALIDATE_SECRET` compartido (NFR-040, Q-016 RESUELTA). Rechazar sin firma válida o timestamp expirado (401). Secret estático, rotación manual solo si se compromete (NO JWT). Rate limit en el endpoint. |
| Tracking | Log de intentos 401 + alerta si > N por minuto. |

### R-ISR-2 — Purge por tag race condition

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Dos webhooks llegan casi simultáneos (post editado dos veces seguidas). La segunda purga puede leer estado inconsistente o pisar la primera. |
| Severidad | Media |
| Mitigación | Astro 7 `Astro.cache` API maneja invalidación por tag atómicamente — purge de un tag invalida todas las rutas cacheadas con ese tag sin race condition. Para webhooks simultáneos del mismo evento, idempotencia: purge del mismo tag dos veces es no-op (la segunda purga no encuentra rutas que purgar, las rutas re-fetchean lazy en próxima request). |
| Tracking | Log de purgas solapadas + métrica de latencia. |

### R-CONTACT-1 — Rate limit misconfiguration DoS

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Si `@Throttle(5, 60_000)` se configura mal (ej: demasiado alto), bots saturan el inbox con spam. Si demasiado bajo, usuarios legítimos bloqueados. |
| Severidad | Media |
| Mitigación | Valor fijo 5 req/min por IP (FR-033). Honeypot field (NFR-042). Monitorear volumen de emails. Q-018 decide si añadir captcha (recomendado honeypot solo en Fase 1). |
| Tracking | Métrica "contact emails per hour" + alerta si > 50/h. |

### R-CONTACT-2 — MailService template render failure (flujos distintos)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `contact-notification.hbs` falla al renderizar (sintaxis Maizzle, variable missing). El endpoint responde 201 pero el email no se envía → usuario cree que envió pero admin no recibe. |
| Severidad | Media |
| Mitigación | Dos flujos distintos y claros: (1) honeypot relleno = 201 false silent (bot descartado, NO se envía email, no hay conflicto con NFR-042); (2) falla real de envío (SMTP caído, template render error) = 500 (error legítimo, usuario ve toast de error). Try/catch en `contactFormNotification()` que loguea error y lanza excepción; el controller catch upstream responde 500 (NO 201 silencioso). |
| Tracking | Test E2E: POST contacto → verificar email llega. Log de fallos de MailService. Test: template render failure → 500 (no 201). |

### R-TRANSLATION-1 — Polymorphic translation table query complexity

| Aspecto | Detalle |
|---------|---------|
| Riesgo | La tabla `translation` polimórfica (`entityName`+`entityId`) es compleja de queryar (JOINs condicionales, N+1 si se hace mal). |
| Severidad | Baja (mitigada server-side) |
| Mitigación | El endpoint `/posts/public` ya resuelve esto server-side via `loadTranslationsForPosts()` + `attachTranslations()` y adjunta `translations` al post. Astro NO hace queries polimórficas; recibe el campo traducido. |
| Tracking | N/A para Astro. Performance del endpoint es problema de backend (ya manejado). |

### R-COOLIFY-1 — Cache no persistencia en container restart

| Aspecto | Detalle |
|---------|---------|
| Riesgo | El cache ISR DIY vive en memoria del proceso Node (Coolify container). Si el container restartea (deploy, crash, OOM), el cache se pierde y se regenera en la próxima request (cold start — la primera request a cada ruta re-fetchea NestJS). |
| Severidad | Baja |
| Mitigación | Aceptable para un proyecto de 1 container Coolify. La regeneración es automática (lazy en próxima request, SWR no aplica porque no hay cache stale). Si se requiere durabilidad, añadir Redis cache layer en iteración futura (out-of-scope). No hay pérdida de datos — solo de cache, que se reconstruye. |
| Tracking | Métrica "cold start latency" post-restart. Si > 5s para regenerar cache completo, evaluar Redis. |

---

## Matriz severidad / probabilidad

| Riesgo | Severidad | Probabilidad | Prioridad |
|--------|-----------|--------------|-----------|
| R2 Consistencia visual | Media | Media | Media |
| R3 Build acoplado backend | Alta | Media | Alta |
| R5 Deuda landing | Media | Alta | Media |
| R6 Referencias residuales | Baja | Baja | Baja |
| R10 SEO regression | Alta | Baja (mismas URLs) | Alta |
| R-ISR-1 Webhook spoofing | Alta | Media | Alta |
| R-ISR-2 Race condition purge | Media | Baja | Media |
| R-CONTACT-1 Rate limit DoS | Media | Media | Media |
| R-CONTACT-2 Template render | Media | Baja | Media |
| R-TRANSLATION-1 Poly translation | Baja | Baja (mitigada) | Baja |
| R-COOLIFY-1 Cache no persistencia | Baja | Baja (restart raro) | Baja |

## Prioridad de mitigación

1. **Alta**: R3 (build acoplado), R10 (SEO regression), R-ISR-1 (webhook spoofing).
2. **Media**: R2, R5, R-ISR-2, R-CONTACT-1, R-CONTACT-2.
3. **Baja**: R6, R-TRANSLATION-1, R-COOLIFY-1.