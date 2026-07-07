---
doc: cms-audit/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

La extensión CMS Audit & Gap Analysis automatiza la detección de gaps en el contenido del CMS Foundation: SEO incompleto, JSON-LD faltante o mal tipado, traducciones ausentes, hardcodes, bugs conocidos (ej: query a tabla vieja `page` vs `ext_cms_page`), sitemap sin integrar en frontend, etc. Hoy la auditoría es manual (`docs/extensions/cms-audit.md` documenta ~80% de completion). Este PRD especifica dashboards (score por página, distribución de issues, tendencias), forms automatizados (auto-config de checks según tipo de contenido), scheduling de auditorías recurrentes (cron semanal), y endpoints backend REST. Consume el catálogo `base-ui-components` (FR-001, FR-003, FR-004, FR-005, FR-006, FR-011).

## Problema

- **Auditoría manual**: hoy un humano revisa el CMS contra `docs/extensions/cms-audit.md` para encontrar gaps. Lento, error-prone, no repetible.
- **Gaps conocidos no trackeados**: BUG #1 (query a `page` en vez de `ext_cms_page`), APP_URL hardcodeado, idiomas hardcodeados en sitemap, JSON-LD `BlogPosting` inexistente, sitemap frontend no integrado — están documentados pero sin sistema que los detecte y reporte automáticamente.
- **Sin visibilidad de cobertura SEO**: no hay métrica de "qué % de páginas tiene metaDescription, JSON-LD, hreflang correctamente poblados".
- **Sin histórico**: no se puede comparar "el CMS estaba mejor hace 3 meses" porque no hay auditorías previas almacenadas.
- **Dashboards pobres**: no existen componentes base para render score (gauge), distribución de issues (donut/bar), KPIs (stat cards). El catálogo base-ui-components los provee.

## Objetivos medibles

1. **Detección automática de gaps**: al menos 10 tipos de checks (SEO meta faltante, JSON-LD faltante o tipo incorrecto, traducciones ausentes por idioma, hardcodes, tabla vieja, sitemap no integrado, hreflang roto, canonical vacío, OG image faltante, robots policy inválido).
2. **Score por página/sección**: cada página auditada recibe un score 0-100. Dashboard muestra gauge promedio del CMS.
3. **Cobertura medible**: % de páginas con SEO completo, % con JSON-LD, % con traducciones en todos los idiomas.
4. **Auditoría agendada**: operador puede configurar audit semanal vía `CronScheduleEditor` (FR-006) + `CronNextRunsPreview` (FR-009).
5. **Histórico comparativo**: almacenar resultados de auditorías previas, mostrar tendencia (TrendChart implícito via StatCard deltas).
6. **On-demand**: lanzar auditoría inmediata desde el dashboard.

## No-objetivos

- **Auto-fixear** gaps detectados (solo detectar y reportar). Auto-fix es PRD futuro.
- **Refactor de la extensión CMS** (`cms` parent). Solo se AUDITA, no se modifica.
- **Auditar contenido de otras extensiones** (affiliate, crm, etc.). Scope = CMS solo.
- **Implementar el catálogo base-ui-components** (eso es PRD aparte).
- **Design del dashboard layout** (grid, drag-drop). Se usa layout simple de cards.
- **Scraping externo** (Google Search Console, Ahrefs). Solo análisis interno del contenido CMS.

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| Tipos de checks implementados | ≥ 10 | Conteo de `AuditCheckType` en `extensions/cms-audit/` |
| Score promedio CMS visible | Dashboard | GaugeChartCard en `/cms/audit` |
| Páginas auditadas por run | 100% | Todas las `ext_cms_page` + `ext_cms_blog_post` |
| Reducción tiempo manual de auditoría | ≥ 80% | Antes: ~4h manual. Después: < 30min revisión de reporte |
| Auditorías agendadas activas | ≥ 1 | Configuradas via CronScheduleEditor |
| Histórico retenido | ≥ 12 runs | Tabla `ext_cms_audit_run` |
| Lint + type-check | passing | `pnpm lint` + `pnpm check-types` verdes |
| i18n | es/en cubiertos | Strings de dashboard en `i18n/locales/{es,en}/cms-audit.json` |