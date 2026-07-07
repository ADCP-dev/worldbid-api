---
doc: crm/07-open-questions
title: "Preguntas Abiertas"
status: draft
created: 2026-07-07
---

# Preguntas Abiertas

## Q-001 — Integración email (Gmail/Outlook)
**Pregunta**: ¿CRM se integra con Gmail/Outlook para sync de emails inbound como interacciones automáticas?
Opciones:
- (a) No — interacciones se registran manuales (estado actual).
- (b) Sí — OAuth Gmail API + Graph API Outlook, webhook inbound, auto-crear `CrmInteraction` tipo `email` desde emails recibidos de clientes.
- (c) Sí pero solo outbound — loggear emails enviados vía SMTP del módulo `email` existente.
**Recomendación**: (c) como primer paso (usa infra existente, sin OAuth). (b) como PRD futuro (scope grande: OAuth flow, token refresh, webhook server, mapping email→cliente).
**Impacto si no se resuelve**: no bloqueante. FR-011 (LinkedSelect) y forms automatizados funcionan sin esto.
**Estado**: pendiente decisión de producto.

## Q-002 — Enriquecimiento automático (LinkedIn/Clearbit)
**Pregunta**: ¿al crear contacto/cliente, se enriquece automáticamente con datos de LinkedIn/Clearbit (logo empresa, industry, size, website)?
**Recomendación**: NO por defecto (privacy-first, NFR-004). Opt-in vía `extension.config` flag `CRM_AUTO_ENRICH=false` default. Si se activa, requiere consentimiento explícito del cliente (checkbox en form). Cache en `metadata` jsonb.
**Impacto si no se resuelve**: no bloqueante. Auto-fill `companyName` (FR-010) cubre el caso mínimo sin API externa.
**Estado**: pendiente. Recomendación: no incluir en este PRD, dejar para futuro.

## Q-003 — Scheduling (weekly report + follow-up reminders)
**Pregunta**: ¿se incluye `CronScheduleEditor` (FR-006 base) para configurar weekly report y follow-up reminders?
**Recomendación**: sí, pero como fase separada (no bloquea dashboard ni forms). Requiere:
- Nuevo `extension.config.ts` con `CRM_WEEKLY_REPORT_CRON`, `CRM_WEEKLY_REPORT_EMAIL`, `CRM_FOLLOWUP_CRON`, `CRM_FOLLOWUP_EMAIL`.
- Nuevo `CrmReportService` con `@Cron` + Bull queue + Nodemailer.
- Página `settings/scheduling.vue` con `CronScheduleEditor` + `CronNextRunsPreview`.
- Migración para persistir config editada (si se quiere editable en vivo, no solo env var).
**Impacto si no se resuelve**: bloqueante para FR-020 y FR-021. Resto del PRD funciona sin esto.
**Estado**: pendiente aprobación. Si se aprueba, añadir `06-migration-phases.md`.

## Q-004 — ownerId + round-robin assignment
**Pregunta**: ¿se añade `ownerId` FK a `CrmClientEntity` (vendedor asignado) y se implementa round-robin auto-assignment?
**Recomendación**: añadir `ownerId` FK nullable a `CrmClientEntity` (migración) + UI de asignación manual en `clients/[id].vue`. Round-robin automático queda como PRD futuro (requiere lógica de "siguiente vendedor disponible" + reglas de skip).
**Impacto si no se resuelve**: no bloqueante. Dashboard funciona sin owner. "Top vendedores" KPI queda fuera de scope.
**Estado**: pendiente. Si se añade ownerId, requiere migración.

## Q-005 — Status del proyecto: ¿depende del cliente o es global?
**Pregunta**: en `projects/new.vue`, ¿el status del proyecto depende del cliente seleccionado o es un catálogo global independiente?
**Contexto**: `CrmProjectEntity.status` es `varchar` (no FK a `CrmStatusEntity`). Los statuses de proyecto (`quoted`, `in_progress`, `completed`, `cancelled`, `pending`) son string literals, no catálogo. `CrmStatusEntity` es para clientes, no proyectos.
**Recomendación**: NO usar `LinkedSelect` aquí — `FormSelect` suelto con options hardcoded de `CrmProjectEntity.type` enum (`pack_1..custom`). FR-012 se simplifica. `LinkedSelect` queda solo para cliente→contacto (FR-011).
**Impacto si no se resuelve**: menor — FR-012 se ajusta.
**Estado**: se asume NO LinkedSelect para projects (FR-012 se simplifica a FormSelect).

## Q-006 — Import/export CSV
**Pregunta**: ¿CRM soporta import/export CSV de clientes/contactos?
**Recomendación**: no en este PRD. Import masivo requiere validación de duplicados, mapeo de columnas, rollback. Export CSV es trivial (endpoint `GET /crm/clients?format=csv`). Dejar export como NFR-007 opcional, import como PRD futuro.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: fuera de scope. Si producto lo pide, PRD separado.

## Q-007 — GDPR "right to erasure" path
**Pregunta**: ¿se añade endpoint de hard-delete o anonymize para cumplir GDPR "right to erasure"?
**Recomendación**: añadir `PATCH /crm/clients/:id/anonymize` (admin-only) que setea `email=NULL, phone=NULL, nif=NULL, name='Anonymized', companyName=NULL, address=NULL` preservando el registro para métricas históricas. Soft-delete adicional. Más seguro que hard-delete (preserva integridad referencial).
**Impacto si no se resuelve**: medio (R-01 GDPR). Recomendación: incluir como FR-041 en este PRD.
**Estado**: pendiente. Si se aprueba, añadir FR-041.

## Q-008 — CrmProjectEntity.price: ¿mensual recurrente o total?
**Pregunta**: `CrmProjectEntity.price` (decimal 10,2) — ¿es el valor mensual recurrente (MRR contribution) o el valor total del proyecto?
**Contexto**: el campo es nullable, sin documentación clara. `type` enum (`pack_1..custom`) sugiere packs de precio fijo pero no aclara periodicidad.
**Recomendación**: clarificar con producto. Si es total, MRR = `SUM(price) / duration_months` (necesita `endDate - startDate`). Si es recurrente, MRR = `SUM(price WHERE status='active' AND paymentStatus='paid')` directo.
**Impacto si no se resuelve**: bloqueante para FR-001 (StatCard MRR) — el cálculo depende de la respuesta.
**Estado**: [NEEDS CLARIFICATION] — preguntar a producto/owner del schema.

## Q-009 — Componentes nuevos faltantes en catálogo base
**Pregunta**: ¿CRM necesita componentes que NO están en el catálogo `base-ui-components`?
Candidatos:
- **FunnelChartCard**: el pipeline (lead→discovery→proposed→active) es un funnel, no un bar chart genérico. `BarChartCard` horizontal lo aproxima pero no muestra "drop-off" entre stages. ¿Se añade `FunnelChartCard` al catálogo base?
- **TimelineComponent**: las interacciones recientes se renderizan con `<ul class="timeline">` DaisyUI. ¿Hay un componente base `ActivityTimeline` o se mantiene inline?
- **ContactAvatar**: avatar con iniciales + foto. ¿Existe en base o es inline?
**Recomendación**: 
- `FunnelChartCard`: proponer al PRD base-ui-components como FR-006 nuevo. Mientras tanto, `BarChartCard` horizontal es aceptable.
- `ActivityTimeline`: mantener inline DaisyUI (es contenido, no data-viz). No justifica componente base.
- `ContactAvatar`: ya existe `UserAvatar` en `@base/ui-app/components/kanban/`. Reusar.
**Impacto si no se resuelve**: no bloqueante. `BarChartCard` cubre funnel aproximadamente.
**Estado**: `FunnelChartCard` propuesto al catálogo base (Q-010 base-ui). Resto cerrado.

## Q-010 — Conversión lead→cliente: ¿cómo se calcula?
**Pregunta**: FR-032 `GET /crm/dashboard/conversion` retorna `{leadToActive, proposedToActive}`. ¿Cómo se calcula?
Opciones:
- (a) Ratio simple: `activeClients / totalClients * 100`.
- (b) Cohort: clientes creados en mes X que llegaron a active en mes Y.
- (c) Funnel drop-off: `active / lead * 100` (clientes que pasaron de lead a active).
**Recomendación**: (c) simple para v1. Cohort (b) es más rico pero requiere tracking de `statusHistory` (no existe hoy). Dejar (b) como futuro.
**Impacto si no se resuelve**: no bloqueante (FR-032 se implementa con (c)).
**Estado**: se asume (c) salvo objeción.