---
doc: affiliate/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos

### R-01 — Cálculo de comisiones = dinero real
**Riesgo**: cualquier bug en `commissionAmount` (rate mal aplicado, baseAmount erróneo, status transición incorrecta) implica pago de más/menos a partners. Impacto financiero directo.
**Impacto**: alto.
**Mitigación**: (1) cálculo SIEMPRE en backend (`CommissionService.create`) — nunca en frontend. (2) Previsualización en form es informativa, no autoritativa. (3) Audit log de transiciones de status (NFR-006). (4) Test coverage del cálculo (DoD). (5) Revisión humana antes de `paid` (Q-003: payout manual vs auto).

### R-02 — Performance de agregados del dashboard
**Riesgo**: `getDashboard()` extendido (FR-040) hace 6+ queries agregadas (COUNT, SUM, GROUP BY) sobre `ext_affiliate_*`. Con volumen alto de comisiones, puede degradar.
**Impacto**: medio.
**Mitigación**: (1) índices existentes (`referralId`, `projectId`, `status`). (2) `monthlyTrend` acotado a 12 meses. (3) Cache en memoria (TTL 5min) opcional — ver Q-007. (4) NFR-001: < 500ms backend.

### R-03 — Cron no se aplica en vivo
**Riesgo**: el editor (FR-030) persiste el cron, pero `@nestjs/schedule` evalúa el cron al bootstrap. Cambiar el cron via UI NO cambia el schedule del proceso en vivo hasta restart.
**Impacto**: alto (UX confusa).
**Mitigación**: (1) documentar claramente en `affiliate/settings.vue` que el cambio aplica al próximo restart. (2) `CronNextRunsPreview` refleja el cron CONFIGURADO, no el activo. (3) Considerar `SchedulerRegistry` de NestJS para re-dinamizar en vivo — ver Q-005.

### R-04 — Auto-generate de code con colisiones
**Riesgo**: `AFF-XXXXXX` (6 chars) tiene espacio finito. Colisiones en regeneración.
**Impacto**: bajo.
**Mitigación**: (1) validar unicidad en backend antes de insert. (2) hasta 3 intentos de regeneración. (3) si falla, retornar 500 y log. (4) 6 chars alfanuméricos = 36^6 ≈ 2.1B combinaciones — suficiente para volume realista.

### R-05 — LinkedSelect partner→cliente: query costosa
**Riesgo**: optionsB = "clientes no referidos por ese partner" requiere query `crm_client LEFT JOIN ext_affiliate_referral WHERE partnerId != X OR referral IS NULL`. Con muchos clientes, lento.
**Impacto**: medio.
**Mitigación**: (1) paginar optionsB (limite 100 + search). (2) usar `FormSearchSelect` en vez de `FormSelect` si > 100 options. (3) debounce en el search.

### R-06 — IBAN expuesto en frontend
**Riesgo**: si el form de partner muestra IBAN y el usuario no es admin, hay fuga de datos bancarios.
**Impacto**: alto (GDPR/PCI).
**Mitigación**: (1) RBAC estricto — form admin only. (2) portal NO muestra IBAN salvo el propio (partner edita el suyo). (3) NFR: nunca en listados admin.

### R-07 — MRR atribuido: definición ambigua
**Riesgo**: "MRR atribuido" (FR-001) no tiene definición única. ¿Es suma de commissionAmount de converted? ¿Es MRR de los clientes referidos? ¿Es revenue del proyecto asociado?
**Impacto**: medio (KPI erróneo → decisiones erróneas).
**Mitigación**: Q-006 abierta. Mientras, se define como "suma de commissionAmount de comisiones approved+paid en los últimos 30 días" (proxy simple). Revisar con producto.

### R-08 — i18n de estados de comisión
**Riefo**: `pending`/`approved`/`paid` hardcoded en `AffiliateDashboard.vue` actual (`COMMISSION_STATUS_LABELS`).
**Impacto**: bajo.
**Mitigación**: mover a `affiliate.json` namespace `affiliate.commission.status.*`. DoD lo exige.

## Trade-offs

### T-01: Previsualización de comisión vs cálculo solo backend
**Decisión**: mostrar previsualización en form (FR-022) pero cálculo autoritativo en backend.
**Se sacrifica**: pequeño riesgo de divergencia si rate cambia entre render y submit.
**Se gana**: UX — admin ve el importe antes de confirmar.
**Por qué**: el rate se lee del partner del referral al render; backend revalida. Divergencia solo si alguien cambia el rate en otra sesión — aceptable.

### T-02: Cron config-driven vs `SchedulerRegistry` en vivo
**Decisión**: config-driven (env var + DB override) + aplicar al restart (no en vivo).
**Se sacrifica**: edición en vivo del schedule.
**Se gana**: simplicidad (no gestionar lifecycle de jobs en runtime). Coherente con `autonomous-agent` y `upload-post` que ya usan env vars.
**Por qué**: `SchedulerRegistry.deleteCronJob` + `addCronJob` es posible pero frágil (jobs con estado, transacciones en vuelo). Q-005 puede reabrir.

### T-03: Auto-generate de code vs campo manual
**Decisión**: auto-generate `AFF-XXXXXX` (FR-020).
**Se sacrifica**: partners con código legible humanamente (ej: `AFF-JOHN`).
**Se gana**: unicidad garantizada, sin fricción en form.
**Por qué**: el código es para tracking interno/URLs, no para que el partner lo memorice. El referral link usa el code. Q-002 puede permitir override manual.

### T-04: Reescribir AffiliateDashboard.vue vs parchear
**Decisión**: reescribir completamente (ver `06-migration-phases.md`).
**Se sacrifica**: trabajo extra; el `.stat` crudo actual se descarta.
**Se gana**: dashboard con 6 StatCards + 3 charts + 1 gauge, alineado al catálogo.
**Por qué**: parchear sobre `.stat` crudo no aprovecha los componentes base. Mejor partir de cero con StatCard/etc.

### T-05: TanStack Query vs `$fetch` directo
**Decisión**: mantener `useAffiliate()` con `$fetch` (no migrar a TanStack Query en este PRD).
**Se sacrifica**: cache automática, invalidation, retries.
**Se gana**: scope acotado — no reescribir data fetching ahora.
**Por qué**: el PRD se enfoca en UX (dashboards, forms, scheduling). Migración a TanStack es otro PRD. Q-008 abierta.