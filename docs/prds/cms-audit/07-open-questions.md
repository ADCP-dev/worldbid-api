---
doc: cms-audit/07-open-questions
title: "Preguntas Abiertas"
status: draft
created: 2026-07-07
---

# Preguntas Abiertas

## Q-001 — Audit on-demand vs scheduled: ¿ambos modos en v1?
**Descripción**: el PRD especifica ambos. ¿Confirmar que v1 incluye ambos, o scheduled se pospone a v2?
**Impacto**: bloqueante para fase 5. No bloqueante para fases 0-4.
**Recomendación**: implementar on-demand primero (fases 0-4), scheduled en fase 5 separable.

## Q-002 — Tipos de checks: ¿cuál es el catálogo cerrado de v1?
**Descripción**: el PRD lista 10 checks candidatos. ¿Hay checks adicionales del dominio SEO que el cliente espera? (ej: validación de structured data con schema.org validator, detección de imágenes sin alt, detección de broken links).
**Impacto**: no bloqueante (los 10 cubren lo documentado en `docs/extensions/cms-audit.md`).
**Recomendación**: confirmar 10 iniciales; añadir más en iteración.

## Q-003 — Exportable (PDF/CSV): ¿en v1?
**Descripción**: el dashboard y la tabla de findings son útiles, pero ¿el cliente necesita exportar reportes a PDF o CSV para compartir fuera del panel?
**Impacto**: no bloqueante (no aparece en FR-NNN). Si se requiere, añadir FR-037+ y fase extra.
**Recomendación**: posponer a v2. v1 solo vista web.

## Q-004 — Histórico comparativo: ¿comparar dos runs directamente?
**Descripción**: FR-005 muestra tendencia. ¿Se requiere además una vista "diff entre run A y run B" (qué gaps se fixearon, qué nuevos aparecieron)?
**Impacto**: no bloqueante para dashboard básico. Bloqueante si es requisito explícito del cliente.
**Recomendación**: v1 solo tendencia; diff en v2.

## Q-005 — Multi-cms: ¿`LinkedSelect` target A = "cms" único?
**Descripción**: hoy solo existe un CMS (la extensión `cms`). El `LinkedSelect` (FR-011 base) pide options A — ¿preparar para múltiples CMS futuros (ej: wordpress headless integrado) o asumir target único?
**Impacto**: no bloqueante (preparar la UI con un solo option es válido).
**Recomendación**: v1 con target único "Foundation CMS"; estructura preparada para añadir options.

## Q-006 — Score: ¿simple o ponderado por severidad?
**Descripción**: T-04 asume score simple (% de checks pasados). ¿El cliente espera que un finding `critical` penalice más que uno `info`?
**Impacto**: no bloqueante (simple se entrega primero).
**Recomendación**: v1 simple; ponderado en v2 si se pide.

## Q-007 — Notificaciones: ¿email tras run completada?
**Descripción**: `nodemailer` está disponible. ¿Enviar email al operador cuando una audit recurrente termina con score < umbral?
**Impacto**: no bloqueante (no aparece en FR).
**Recomendación**: v1 sin notificaciones; añadir FR-050+ si se requiere.

## Q-008 — Permisos: ¿quién puede leer dashboard?
**Descripción**: FR-040 define `cms-audit:read` y `cms-audit:run`. ¿Esos permisos los hereda el rol `admin` automáticamente, o requieren seed explicit?
**Impacto**: bloqueante para RBAC — definir mapeo rol→permiso.
**Recomendación**: `admin` hereda ambos; seed explícito en `ext_cms_audit_seed`.

## Q-009 — ¿Componentes base NUEVOS faltantes?
**Descripción**: el catálogo base-ui-components cubre KPIs, charts, cron, linked-select. ¿cms-audit necesita algún componente base NO incluido en ese catálogo? Ej: un `SeverityBadge` estandarizado, un `ScoreHistorySparkline` (caso específico de TrendChart), un `ChecklistEditor` (para seleccionar checks individualmente — hoy se asume auto-config por profile).
**Impacto**: no bloqueante si se reutilizan los del catálogo. Si hace falta uno nuevo, añadirlo al PRD base.
**Recomendación**: revisar tras prototipo de `AuditRunForm`. `SeverityBadge` probablemente útil transversal → candidato a añadir al catálogo base.

## Q-010 — Concurrencia de checks: ¿configurable por operador o fija?
**Descripción**: NFR-001 menciona concurrencia default 10. ¿Expone este valor en el form de run, o queda en config del backend (`extension.config.ts`)?
**Impacto**: no bloqueante (default fijo es razonable).
**Recomendación**: config de backend en v1; campo avanzado en form solo si el cliente opera CMS grandes.