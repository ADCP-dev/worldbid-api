---
doc: cms/07-open-questions
title: "Open Questions"
status: draft
created: 2026-07-07
---

# Open Questions

## Q-01 — Autores huésped en BarChartCard por autor
**Pregunta**: el `BarChartCard` top 5 autores (FR-105) muestra `UserEntity`. ¿Hay posts con `author` como string libre (no user)? El campo `BlogPostEntity.authorId` es nullable y existe `author?: string` en el DTO.
**Impacto**: no bloqueante. Si hay autores-string, aparecen como "Otros" o se filtran.
**Recomendación**: por ahora solo users; si hay autores-string libres, agrupar bajo "Invitados".

## Q-02 — Lógica de filtraje LinkedSelect categoría→tags
**Pregunta**: el `LinkedSelect` (FR-113) filtra B por A. ¿Cómo se filtran tags por categoría?
- (a) Tags asociados a posts de esa categoría (heurística, query sobre `ext_cms_blog_post_tag` JOIN).
- (b) Relación directa tag↔categoría (requiere nueva tabla `ext_cms_tag_category`).
- (c) Sin filtraje real, LinkedSelect solo muestra todos los tags (LinkedSelect no aporta valor).
**Impacto**: bloqueante para Fase 3. Si (b), hay que añadir tabla + migración.
**Recomendación**: (a) heurística. Permite LinkedSelect sin esquema nuevo. Revisar performance con muchos posts.

## Q-03 — Versionado de posts
**Pregunta**: ¿los posts deben tener versionado (guardar snapshots, revertir)?
**Impacto**: no bloqueante para este PRD. Sería otro PRD separado.
**Recomendación**: fuera de scope. Documentar como "no-objetivo" ya está.

## Q-04 — Fuente de views/analytics
**Pregunta**: el dashboard quiere mostrar views por post y trend de views. ¿Hay una fuente (Google Analytics API, Plausible, interno)?
**Impacto**: bloqueante para FR de views específicos. Los StatCards genéricos (publicados, programados) NO dependen de esto.
**Recomendación**: si no hay fuente, omitir views y reemplazar por "días desde última publicación" (FR-107). Dejar FR de views como `[NEEDS CLARIFICATION]` hasta resolver.

## Q-05 — Custom post types
**Pregunta**: ¿el CMS debe soportar tipos de contenido más allá de Page y BlogPost (events, products, case studies)?
**Impacto**: no bloqueante. Sería arquitectura mayor (tabla polimórfica o tablas separadas).
**Recomendación**: fuera de scope. Si surge, PRD aparte.

## Q-06 — Roles CMS granulares (writer/editor/publisher/admin)
**Pregunta**: el manifest declara 15 permisos (`cms:posts:publish` etc.) pero los controllers solo usan `@Roles(RoleEnum.admin)`. ¿Migrar a permisos granulares + nuevos roles?
**Impacto**: bloqueante para Fase 5 (RBAC). No bloqueante para fases 0–4.
**Recomendación**: postergar a fase 5. Las fases 0–4 funcionan con solo admin.

## Q-07 — Invalidación caché SWR tras publicación programada
**Pregunta**: el blog usa SSG+SWR 1h. Tras publicación programada, ¿cómo invalidar para que el post aparezca < 1 min?
Opciones:
- (a) Llamar a `useQueryClient().invalidateQueries(['cms','blog'])` desde frontend cuando detecta nuevo post — no funciona para SSG.
- (b) Webhook backend → Nuxt on-demand revalidation (Nuxt 4 `routeRules` con `swr: 60` + endpoint `POST /api/revalidate`).
- (c) Reducir TTL SWR a 60s en `/[lang]/blog` (pérdida de performance).
- (d) Aceptar latencia hasta 1h.
**Impacto**: bloqueante para valor del feature de scheduling (R-01).
**Recomendación**: (b) on-demand revalidation con endpoint `POST /api/revalidate?path=/blog`. Es el patrón Nuxt recomendado.

## Q-08 — Conflictos de edición concurrente
**Pregunta**: dos editores editan el mismo post. ¿Optimistic locking (versión ETag), pessimistic lock, o warn suave?
**Impacto**: no bloqueante para este PRD. R-04 documentado pero no resuelto.
**Recomendación**: warn suave (comparar `updatedAt` al guardar) en este PRD. Locking real en PRD aparte.

## Q-09 — ScheduleModule registrado
**Pregunta**: ¿`@nestjs/schedule` `ScheduleModule.forRoot()` está registrado en `infrastructure.module.ts`? El package está instalado pero hay que confirmar wiring.
**Impacto**: bloqueante para Fase 1 (cronjob).
**Recomendación**: verificar al iniciar Fase 1; si no está, añadir (1 línea).

## Q-10 — Multi-instancia del backend
**Pregunta**: ¿el backend corre en una sola instancia o múltiples (k8s, PM2 cluster)? Determina si `@Cron` directo publicaría duplicado.
**Impacto**: bloqueante para Fase 1 (R-06). Si multi-instancia, usar `@Processor` de Bull solo (no `@Cron` directo para publicar).
**Recomendación**: asumir multi-instancia, usar Bull `@Processor`. `@Cron` solo encola (idempotente).

## Q-11 — Workflow draft→review→publish
**Pregunta**: ¿hay estados intermedios entre draft y published (review, approved)?
**Impacto**: no bloqueante. El sistema actual es binario (`isPublished` boolean).
**Recomendación**: fuera de scope. Sería PRD separado de workflow editorial.

## Q-12 — Sitemap tras publicación programada
**Pregunta**: cuando un post se publica vía cronjob, ¿el sitemap (`/sitemap/blog`) se actualiza automáticamente?
**Impacto**: bajo. El sitemap se regenera con SWR 1h; el post aparecerá en el próximo ciclo.
**Recomendación**: aceptar latencia hasta 1h para sitemap. No crítico.