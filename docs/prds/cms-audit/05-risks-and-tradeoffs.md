---
doc: cms-audit/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos técnicos

### R-01 — Rendimiento en CMS grandes (Alta)
**Riesgo**: una auditoría sobre miles de páginas + 10 checks por página puede tardar minutos y saturar la DB con queries N+1.
**Mitigación**:
- Procesamiento async en BullMQ processor (no bloquea API).
- Carga batch de entidades con `find({ relations: ['seoMetadata'] })` en lugar de query por página.
- Concurrencia configurable (default 10 páginas en paralelo).
- Cache de resultados por content-hash: si la página no cambió desde la última run, reusar findings.
**Trade-off**: complejidad de cache vs performance. Aceptable.

### R-02 — False positives en checks (Media)
**Riesgo**: un check marca "JSON-LD faltante" pero la página sí lo tiene generado en frontend via `useSchema`. El check solo ve el backend.
**Mitigación**:
- Documentar alcance de cada check: "audit analiza estado del BACKEND cms, no render final".
- Permitir marcar findings como "falso positivo" o "ignorado" (status en `ext_cms_audit_finding`) con razón.
- En dashboard distinguir "backend gaps" vs "frontend gaps" (sitemap integration es un check aparte).
**Trade-off**: el score puede ser conservador (baja ante falsos positivos no marcados).

### R-03 — Consistencia entre runs (Media)
**Riesgo**: si el contenido cambia durante una run, el resultado puede ser inconsistente (page auditada en t0, otra en t1).
**Mitigación**: snapshot del `updatedAt` de cada entidad auditada; si cambió durante la run, marcar finding como "stale" y recomendar re-audit.
**Trade-off**: overhead de tracking. Aceptado solo si CMS es muy volátil.

### R-04 — Acoplamiento al schema de `cms` parent (Media)
**Riesgo**: si `cms` renombra `ext_cms_page` o cambia `SeoMetadataEntity`, los checks rompen silenciosamente.
**Mitigación**:
- Consumir via interfaces de dominio (`PageRepository.findBySection()`) no queries crudas.
- Tests de integración que validen checks contra fixtures del cms parent.
- Versionar `extension.manifest.ts` con `cms: '^1.0.0'`.
**Trade-off**: indirection via repos vs queries directas.

### R-05 — Cron dinámico no persiste tras restart (Baja)
**Riesgo**: `SchedulerRegistry` pierde crons registrados en memoria si NestJS restart.
**Mitigación**: persistir schedules en `ext_cms_audit_run_config` y re-registrar al boot (`OnModuleInit` lee la tabla y restaura crons).
**Trade-off**: requiere tabla extra. Aceptable.

## Riesgos de seguridad

### R-06 — Acceso a findings expone estructura del CMS (Baja)
**Riesgo**: un usuario con `cms-audit:read` podría inferir estructura interna (tablas, ids).
**Mitigación**: RBAC estricto — `cms-audit:read` y `cms-audit:run` son permisos separados, restringidos a admin.
**Trade-off**: no exponer findings a roles no-admin (no hay versión "pública" del score).

## Trade-offs

### T-01 — Async vs Sync audit
**Decisión**: async via BullMQ.
**Sacrifica**: feedback inmediato (operador espera polleo).
**Gana**: no bloquear API, escalar a CMS grandes, progreso observable.
**Por qué**: auditorías > 100 páginas serían inviables sync.

### T-02 — Persistir cada finding individual vs solo aggregate
**Decisión**: tabla `ext_cms_audit_finding` con una row por hallazgo.
**Sacrifica**: storage (potencialmente miles de rows por run).
**Gana**: filtrado, histórico, export CSV futuro, drill-down.
**Por qué**: sin filas individuales no hay dashboard de "últimas findings" ni export.

### T-03 — Auto-config de checks por profile vs checks manuales
**Decisión**: `audit profile` pre-selecciona checks.
**Sacrifica**: flexibilidad de selección check-por-check (aunque se puede override).
**Gana**: UX para operadores no técnicos — un select y listo.
**Por qué**: el catálogo base-ui-components provee `LinkedSelect` (FR-011) que encaja con este modelo.

### T-04 — Score 0-100 simple vs score ponderado
**Decisión**: score simple = % de checks pasados. Pesos por severidad en una segunda iteración (Q-006).
**Sacrifica**: granularidad (un finding critical penaliza igual que uno info).
**Gana**: comprensible para operador.
**Por qué**: el gauge ya comunica 0-100%. Complejidad de pesos se añade si se pide.