---
doc: crm/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## Requisitos funcionales (FR-NNN) — Dashboard

### FR-001 — StatCards del dashboard
THE SYSTEM SHALL renderizar 4 `StatCard` (FR-001 catálogo base) en `CrmDashboard.vue`:
- Total clientes (`dashboard.totalClients`)
- Clientes activos (`dashboard.activeClients`, `icon='Users'`)
- Pipeline value (`SUM(projects.price WHERE status='active')`, `unit='€'`)
- MRR (`getMrr()`, `unit='€'`, `delta` vs mes anterior si disponible).
WHEN `loading=true` THE SYSTEM SHALL mostrar skeleton en cada StatCard.
IF un KPI no tiene datos THE SYSTEM SHALL mostrar `0` y description "Sin datos".

### FR-002 — TrendChart clientes nuevos
THE SYSTEM SHALL renderizar 1 `TrendChart` (FR-002 base) con serie temporal de clientes nuevos (eje X = fecha, eje Y = count) para el rango seleccionado (30d default, 90d toggle).
THE SYSTEM SHALL consumir `useCrm().getDashboardTrends(range)` que llama a `GET /crm/dashboard/trends?range=30d`.
IF `data.length === 0` THE SYSTEM SHALL mostrar empty-state "Sin clientes nuevos en el período".

### FR-003 — BarChartCard pipeline por stage
THE SYSTEM SHALL renderizar 1 `BarChartCard` (FR-003 base, `orientation='horizontal'`) con `data = dashboard.clientsByStatus.map(s => ({label: s.label, value: s.count}))`.
THE SYSTEM SHALL respetar `s.color` del status como color de barra (slot/prop `colorByDatum` si el wrapper lo expone; si no, mapeo vía `useThemeColors` + override).
IF `clientsByStatus.length === 0` THE SYSTEM SHALL mostrar empty-state.

### FR-004 — BarChartCard clientes por origen
THE SYSTEM SHALL renderizar 1 `BarChartCard` (FR-003 base, `orientation='horizontal'`) con `data = dashboard.clientsByOrigin.map(o => ({label: o.label, value: o.count}))`.
THE SYSTEM SHALL aceptar `title='Clientes por origen'`.

### FR-005 — DonutChartCard distribución de status
THE SYSTEM SHALL renderizar 1 `DonutChartCard` (FR-004 base) con `data = dashboard.clientsByStatus.map(s => ({label: s.label, value: s.count, color: s.color}))`.
THE SYSTEM SHALL mostrar `centerLabel='Total'` y `centerValue=dashboard.totalClients`.
WHEN un segmento se hover THE SYSTEM SHALL mostrar tooltip con valor absoluto y %.

### FR-006 — TrendChart interacciones (opcional, ⚠️ tier 2)
THE SYSTEM SHALL renderizar 1 `TrendChart` (FR-002 base) con serie de interacciones por semana.
IF el backend no expone `interactionsTrend` en `/trends` THE SYSTEM SHALL omitir este chart y documentar como `[NEEDS CLARIFICATION]`.

## Requisitos funcionales — Forms automatizados

### FR-010 — Auto-fill companyName desde email
WHEN el usuario ingresa `email` en `clients/new.vue` AND `companyName` está vacío THE SYSTEM SHALL extraer el dominio (`email.split('@')[1]`), capitalizar (`acme.com` → `Acme`), y sugerirlo en `companyName` como placeholder pre-rellenado.
THE SYSTEM SHALL NO sobrescribir `companyName` si el usuario ya tipeó un valor.
THE SYSTEM SHALL proveer un composable `useAutoFillCompany(emailRef, companyNameRef)` en `extensions/crm/composables/`.

### FR-011 — LinkedSelect cliente→contacto en crear interacción
THE SYSTEM SHALL renderizar 1 `LinkedSelect` (FR-021 base) en la página de crear interacción con:
- `optionsA = clientes` (cargados via `useCrm().getClients()`)
- `optionsB = (clientId) => useCrm().getContacts(clientId)`
- `v-model = {a: clientId, b: contactId}`.
WHEN el usuario selecciona un cliente THE SYSTEM SHALL reset `contactId` y cargar los contactos de ese cliente.
IF `autoFill=true` AND solo queda 1 contacto THE SYSTEM SHALL auto-seleccionarlo.

### FR-012 — LinkedSelect cliente→status en crear proyecto
THE SYSTEM SHALL renderizar 1 `LinkedSelect` (FR-021 base) en `projects/new.vue` con:
- `optionsA = clientes`
- `optionsB = (clientId) => statuses` (los statuses son globales, no dependen de cliente — usar `LinkedSelect` solo si se quiere filtrar por status actual del cliente; si no, `FormSelect` suelto es suficiente).
[NEEDS CLARIFICATION — Q-005: ¿el status del proyecto depende del cliente o es global?]

### FR-013 — Auto-suggest deal stage desde actividad
WHEN un cliente tiene ≥3 interacciones de tipo `meeting` en los últimos 14 días AND su status es `lead` THE SYSTEM SHALL sugerir moverlo a `discovery` (banner/toast en `clients/[id].vue`).
THE SYSTEM SHALL NO mover automáticamente — solo sugerir con CTA "Mover a Discovery".

## Requisitos funcionales — Scheduling (⚠️ Ask first — Q-003)

### FR-020 — CronScheduleEditor weekly report (⚠️)
IF Q-003 se aprueba THE SYSTEM SHALL renderizar `CronScheduleEditor` (FR-006 base) en `pages/app/crm/settings/scheduling.vue` con `mode='weekly'` default `0 9 * * 1`.
THE SYSTEM SHALL persistir el cron en `extension.config` (`CRM_WEEKLY_REPORT_CRON`).
THE SYSTEM SHALL mostrar `CronNextRunsPreview` (FR-013 base) con próximas 5 ejecuciones.

### FR-021 — Follow-up reminders (⚠️)
IF Q-003 se aprueba THE SYSTEM SHALL permitir configurar un cron para reminders de follow-up (clientes sin interacción en N días).
THE SYSTEM SHALL encolar email via Bull a `NOTIFICATION_EMAIL` o `CRM_FOLLOWUP_EMAIL`.

## Requisitos funcionales — Endpoints backend (extensión)

### FR-030 — GET /crm/dashboard/trends
THE SYSTEM SHALL exponer `GET /crm/dashboard/trends?range=30d|90d` (admin-only) retornando:
```
{ series: { date: string, newClients: number, interactions: number, pipelineValue: number }[] }
```
THE SYSTEM SHALL agregar por día (range=30d) o por semana (range=90d) para optimizar payload.

### FR-031 — GET /crm/dashboard/mrr
THE SYSTEM SHALL exponer `GET /crm/dashboard/mrr` (admin-only) retornando `{ current: number, previous: number, delta: number }`.
THE SYSTEM SHALL calcular `current = SUM(price) WHERE status='active' AND paymentStatus='paid'` en el mes actual; `previous` en el mes anterior.

### FR-032 — GET /crm/dashboard/conversion
THE SYSTEM SHALL exponer `GET /crm/dashboard/conversion` retornando `{ leadToActive: number, proposedToActive: number }` (ratios de conversión entre stages).

## Requisitos funcionales — RBAC

### FR-040 — Mantener admin-only en endpoints nuevos
THE SYSTEM SHALL aplicar `@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(RoleEnum.admin)` en `CrmDashboardController` para los nuevos endpoints `/trends`, `/mrr`, `/conversion`.

## Requisitos no funcionales (NFR-NNN)

### NFR-001 — Performance dashboard
WHEN el dashboard renderiza THE SYSTEM SHALL cargar en < 500ms (datos + render).
THE SYSTEM SHALL usar TanStack Query con `staleTime: 60_000` para evitar refetch excesivo.
WHEN `TrendChart` renderice > 90 puntos THE SYSTEM SHALL renderizar en < 200ms (NFR-001 base).

### NFR-002 — i18n
THE SYSTEM SHALL sourcear todos los textos desde `apps/front/i18n/locales/{es,en}/crm.json` bajo namespace `crm`.
THE SYSTEM SHALL traducir: títulos de KPIs ("Total clientes", "Pipeline value", "MRR"), labels de stages ("Lead", "Discovery", "Proposed", "Active", "Churned" — ya vienen en `CrmStatusEntity.label` pero son datos, no i18n; los headers de cards sí via i18n), empty-states, "Mover a Discovery", "Sin datos en el período".
THE SYSTEM SHALL respetar locale `es` por defecto, `en` alternativo.

### NFR-003 — Accesibilidad
THE SYSTEM SHALL proveer ARIA roles en todos los controles nuevos (LinkedSelect, toggle 30d/90d, CTA "Mover a Discovery").
THE SYSTEM SHALL habilitar `a11yTable` en charts del dashboard para screen readers (opt-in via prop).

### NFR-004 — Privacy (GDPR/LPD)
THE SYSTEM SHALL tratar `CrmContact.email`, `CrmContact.phone`, `CrmClient.email`, `CrmClient.phone`, `CrmClient.nif` como datos personales.
THE SYSTEM SHALL NO exponer estos campos en logs (`Logger` solo loguea IDs, nunca PII).
THE SYSTEM SHALL proveer endpoint `DELETE /crm/clients/:id` con soft-delete (ya existe) Y un path de hard-delete o anonymize para GDPR "right to erasure" (ver Q-007).
THE SYSTEM SHALL NO enviar PII a servicios externos (enriquecimiento LinkedIn/Clearbit) sin consentimiento explícito (ver Q-002).

### NFR-005 — Responsive
THE SYSTEM SHALL apilar `StatCard` en grid `grid-cols-1` en mobile, `sm:grid-cols-2`, `lg:grid-cols-4`.
THE SYSTEM SHALL apilar charts verticalmente en mobile (no side-by-side).

### NFR-006 — Themeable
THE SYSTEM SHALL consumir `useThemeColors()` para todos los charts (no colores hardcodeados).
THE SYSTEM SHALL usar DaisyUI semantic classes (`bg-base-100`, `border-base-300`) en cards wrapper.

## Criterios de aceptación (Given/When/Then) — ejemplos

**StatCard MRR**:
- GIVEN dashboard cargado con 3 proyectos active+paid (precios 100, 200, 300)
- WHEN `getMrr()` resuelve
- THEN `StatCard` muestra "600 €" con `unit='€'`.

**Auto-fill company**:
- GIVEN `clients/new.vue`, `email='jane@acme.com'`, `companyName=''`
- WHEN el usuario sale del campo email
- THEN `companyName` muestra "Acme" como valor sugerido (pre-rellenado, editable).

**LinkedSelect cliente→contacto**:
- GIVEN crear interacción, cliente seleccionado tiene 2 contactos
- WHEN A cambia a ese cliente
- THEN B resetea y muestra 2 opciones; si el cliente tuviera 1 contacto Y `autoFill=true`, B se auto-selecciona.

**TrendChart 30d**:
- GIVEN toggle "30 días" activo
- WHEN `getDashboardTrends('30d')` resuelve con 30 puntos
- THEN `TrendChart` renderiza línea con 30 puntos, eje X fechas, eje Y count.