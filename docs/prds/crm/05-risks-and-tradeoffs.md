---
doc: crm/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos

### R-01 — GDPR / LPD (datos personales)
**Riesgo**: CRM almacena PII — `CrmContact.email`, `CrmContact.phone`, `CrmClient.email`, `CrmClient.nif`. Sin path de "right to erasure" (hoy solo soft-delete, los datos quedan en DB).
**Impacto**: alto (multas GDPR hasta 4% revenue global).
**Mitigación**: 
- Soft-delete ya existe (NO expone datos vía API).
- Añadir endpoint `DELETE /crm/clients/:id?hard=true` (admin-only) que anonimiza PII (`email=NULL`, `phone=NULL`, `nif=NULL`, `name='Anonymized'`) preservando el registro para histórico de métricas. Ver Q-007.
- Logs sin PII (regla NFR-004).
- Consentimiento explícito antes de enriquecimiento externo (Q-002).

### R-02 — Data quality (campos vacíos, duplicados)
**Riesgo**: forms actuales permiten `email=null`, `nif=null`, `companyName=null`. Sin validación de duplicados (mismo email en 2 clientes). Dashboard agrega sobre datos sucios.
**Impacto**: medio (KPIs inflados/desinflados, conversión errónea).
**Mitigación**:
- `@Index(['email'])` ya existe en `CrmClientEntity` — añadir unique constraint parcial (email no-null unique). Migración.
- Auto-fill `companyName` (FR-010) reduce campos vacíos.
- Validación de email en DTO (`@IsEmail`) ya existe — extender a `@IsOptional @IsEmail` en update.

### R-03 — Integraciones externas (email, enriquecimiento)
**Riesgo**: si Q-001 (Gmail/Outlook) y Q-002 (LinkedIn/Clearbit) se aprueban, CRM pasa a depender de APIs externas con rate limits, costos, y fallos.
**Impacto**: medio-alto (si Clearbit cae, auto-fill falla; si Gmail OAuth token expira, sync se pausa).
**Mitigación**:
- Integraciones opt-in (feature flag por `extension.config`).
- Fallback graceful: si enriquecimiento falla, form sigue manual.
- Cache de resultados de enriquecimiento en `metadata` jsonb (no re-llamar API por el mismo email).
- Rate limit handling (Bull queue con backoff).

### R-04 — Scheduling no aplica en vivo (R-04 catálogo base)
**Riesgo**: si Q-003 se aprueba, `CronScheduleEditor` edita `CRM_WEEKLY_REPORT_CRON` en config persistida, pero el `@Cron` decorator se evalúa al bootstrap del backend. Cambiar el cron via UI NO cambia el schedule del proceso en vivo.
**Impacto**: alto (limita utilidad del editor en producción).
**Mitigación**: documentar que el editor edita config persistida y que el schedule se aplica al siguiente reinicio. `CronNextRunsPreview` refleja el cron configurado, no el activo. Coordinar con Q-003 catálogo base.

### R-05 — MRR calculado vs real (no hay tabla de suscripciones)
**Riesgo**: MRR se calcula desde `CrmProjectEntity.price` asumiendo que es valor mensual recurrente. Si `price` es valor total del proyecto, MRR se sobreestima.
**Impacto**: medio (KPI erróneo).
**Mitigación**: clarificar Q-008. Si `price` es total, MRR = `SUM(price) / project_duration_months`. Si es recurrente, directo. Documentar la asunción en el `StatCard` description.

### R-06 — Round-robin assignment sin ownerId
**Riesgo**: si Q-004 se aprueba (añadir `ownerId` FK a User), requiere migración + seed de asignación + UI de "Mis clientes" (vista por vendedor). Scope creep.
**Impacto**: medio.
**Mitigación**: limitar Q-004 a "añadir campo + UI de asignación manual" en este PRD. Round-robin automático en PRD futuro. No incluir lógica de auto-assignment en este ciclo.

### R-07 — Refactor dashboard rompe widget injection
**Riesgo**: `CrmDashboard.vue` refactor puede romper `useState('crm:dashboardWidgets')` que consumen otras extensiones (affiliate inyecta widgets).
**Impacto**: medio.
**Mitigación**: preservar el bloque `<div v-for="widget in extensionWidgets">` del template actual. Solo refactor de KPIs/charts propios, no del slot de widgets externos. Test e2e verificando que widgets de affiliate siguen renderizando.

### R-08 — Trends endpoint N+1 en DB grande
**Riesgo**: `getTrends(90d)` agrega 90 días de clientes+interacciones+proyectos. Sin índices en `createdAt`, puede ser lento.
**Impacto**: bajo-medio.
**Mitigación**: usar `createQueryBuilder` con `GROUP BY DATE_TRUNC('day', createdAt)` en vez de cargar entidades. Índices en `createdAt` ya existen vía `@CreateDateColumn`. Cache Redis (si disponible) con TTL 5min.

### R-09 — Catálogo base no implementado aún
**Riesgo**: este PRD referencia FR-001..FR-021 del catálogo `base-ui-components` que está en `status: draft`. Si el catálogo no se implementa, CRM dashboard se bloquea.
**Impacto**: alto (dependencia dura).
**Mitigación**: ordenar ejecución — catálogo base primero, CRM después. Si CRM urge, implementar charts inline temporales con `# TODO: migrate to StatCard when base-ui ready` (deuda técnica explícita).

## Trade-offs

### T-01: Refactor dashboard vs mantener stat cards DaisyUI
**Decisión**: refactor total sobre catálogo base.
**Se sacrifica**: tiempo de implementación (refactor + tests).
**Se gana**: cero duplicación, dashboards consistentes con otras extensiones, trends reales.
**Por qué**: regla R-01 catálogo (≥2 consumers) + DoD CRM (cero charts inline).

### T-02: Auto-fill company via composable local vs endpoint de enriquecimiento
**Decisión**: composable local `useAutoFillCompany` (extrae dominio del email, capitaliza). Endpoint de enriquecimiento (Clearbit/LinkedIn) queda como Q-002 opt-in.
**Se sacrifica**: enriquecimiento rico (logo, industry, size, website).
**Se gana**: cero dependencia externa, cero costo, cero PII leakage, funciona offline.
**Por qué**: privacy-first. Enriquecimiento es feature premium opt-in, no default.

### T-03: MRR desde CrmProjectEntity vs tabla de suscripciones dedicada
**Decisión**: calcular MRR desde `CrmProjectEntity.price` filtrando `status='active' AND paymentStatus='paid'`.
**Se sacrifica**: precisión (si `price` no es recurrente mensual, MRR erróneo — ver Q-008).
**Se gana**: no crear tabla nueva, reutilizar schema existente.
**Por qué**: Stripe ya maneja suscripciones reales (si la extensión stripe está activa). MRR de CRM es proxy de "pipeline value recurrente", no revenue contable.

### T-04: LinkedSelect vs FormSelect sueltos para cliente→contacto
**Decisión**: `LinkedSelect` (FR-021 base) para encadenar.
**Se sacrifica**: flexibilidad de layout (los 2 selects van juntos).
**Se gana**: encapsulamiento de lógica "A cambia → reset B → recompute → autoFill".
**Por qué**: el patrón se repite (interacciones, proyectos). Justifica el componente base.

### T-05: Scheduling opt-in vs out-of-scope
**Decisión**: dejar scheduling como ⚠️ Ask first (Q-003). Si se aprueba, `CronScheduleEditor` + `@Cron` + Bull. Si no, CRM sin cronjobs (estado actual).
**Se sacrifica**: si se rechaza, no hay weekly report automático ni follow-up reminders.
**Se gana**: scope controlado. Scheduling es feature separada, no core de CRM.
**Por qué**: CRM funciona sin scheduling. Añadirlo es valor extra, no bloqueante.