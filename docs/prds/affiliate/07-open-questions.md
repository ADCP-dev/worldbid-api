---
doc: affiliate/07-open-questions
title: "Preguntas Abiertas"
status: draft
created: 2026-07-07
---

# Preguntas Abiertas

## Q-001 — Modelo de comisión: one-time vs recurring
**Pregunta**: ¿la comisión es one-time (al pagarse el proyecto) o recurring (MRR % mientras el cliente esté activo)?
**Estado actual**: one-time — `CommissionService.create()` valida `project.paymentStatus==='paid'` y calcula `baseAmount = project.price × commissionRate` una vez.
**Recomendación**: mantener one-time en este PRD. Recurring es otro modelo (suscripciones) — requiere nueva entidad `AffiliateRecurringCommission` + cron de cálculo mensual. Fuera de scope.
**Impacto si no se resuelve**: no bloqueante. Se documenta que es one-time.
**Estado**: pendiente confirmación de producto.

## Q-002 — Partner code: auto-generate vs manual vs ambos
**Pregunta**: ¿el `code` del partner se auto-genera (`AFF-XXXXXX`), se introduce manualmente, o ambos (auto + override)?
**Recomendación**: auto-generate por defecto + override opcional en form (admin puede tipear custom si quiere `AFF-JOHN`). Validar unicidad en ambos casos.
**Impacto si no se resuelve**: bloqueante para Fase 4 (migration + service). Se asume auto-generate puro en FR-020 mientras.
**Estado**: pendiente producto.

## Q-003 — Payout: automático vs manual
**Pregunta**: ¿el paso `approved → paid` es manual (admin marca) o automático (cron que paga via SEPA/Stripe Transfer)?
**Estado actual**: manual — `CommissionService.update()` cambia status + setea `paidAt`. No hay integración bancaria.
**Recomendación**: mantener manual en este PRD. Payout automático requiere integración con Stripe Connect / SEPA / PayPal Payouts — otro PRD. El dashboard muestra "comisiones aprobadas pendientes de pago" como KPI para que admin actúe.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: cerrado parcialmente — manual confirmado para este PRD. Auto payout = PRD futuro.

## Q-004 — Multi-tier affiliate
**Pregunta**: ¿soporte multi-tier (partner A refiere a partner B, A recibe % del revenue de B)?
**Recomendación**: NO en este PRD. Requiere `parentPartnerId` en entidad + cálculo recursivo. Complejidad alta, adopción incierta.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: descartado para este PRD. Re-abrir si producto lo pide.

## Q-005 — Cron en vivo vs restart
**Pregunta**: ¿el cron editado via UI (FR-030) se aplica en vivo (`SchedulerRegistry.deleteCronJob` + `addCronJob`) o requiere restart del proceso?
**Opciones**:
- (a) Restart — simple, coherente con `autonomous-agent`/`upload-post`.
- (b) En vivo — `SchedulerRegistry` de NestJS, más UX pero frágil (jobs con estado).
**Recomendación**: (a) restart en este PRD. Documentar claramente en UI. (b) como mejora futura si hay demanda.
**Impacto si no se resuelve**: no bloqueante (se implementa (a)). UX debe ser clara ("aplica al próximo reinicio").
**Estado**: pendiente decisión con backend.

## Q-006 — Definición de "MRR atribuido"
**Pregunta**: ¿qué significa exactamente "MRR atribuido" en el StatCard del dashboard?
**Opciones**:
- (a) Suma de `commissionAmount` (approved+paid) últimos 30 días — proxy simple.
- (b) MRR de los clientes referidos (suma de suscripciones activas de clientes con referral converted).
- (c) Revenue de proyectos asociados a comisiones approved+paid.
**Recomendación**: (a) como MVP — reutiliza datos existentes. (b)/(c) requieren join con stripe/subscriptions — otro PRD.
**Impacto si no se resuelve**: bloqueante para FR-001 (StatCard MRR). Se asume (a) mientras.
**Estado**: pendiente producto.

## Q-007 — Cache de dashboard
**Pregunta**: ¿`getDashboard()` (FR-040) se cachea en backend (TTL 5min) o se calcula siempre fresh?
**Recomendación**: fresh en este PRD (NFR-001: < 500ms con índices). Cache si volumen crece y degrada.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: diferido.

## Q-008 — Migración a TanStack Query
**Pregunta**: ¿`useAffiliate()` (que usa `$fetch` directo) se migra a TanStack Vue Query en este PRD?
**Recomendación**: NO en este PRD (T-05). Scope acotado a UX. Migración de data fetching es horizontal (afecta todas las extensiones) — otro PRD.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: diferido.

## Q-009 — Componentes base nuevos detectados
**Pregunta**: durante el análisis, ¿se detectó algún componente que falte en el catálogo base y que affiliate necesite?
**Hallazgo**: sí —
- **CommissionStatusBadge**: badge coloreado (pending/approved/paid) reutilizable. Hoy está hardcoded en `AffiliateDashboard.vue` como `COMMISSION_STATUS_BADGE` map. Aparecerá en crm, stripe, upload-post también (status badges universales). **No se define aquí** — proponer al PRD base como addendum.
- **ReferralLinkDisplay**: input read-only + botón copiar para mostrar el link de referido del partner (`https://app.com/?ref=AFF-XXXXXX`). Aparece en portal. Podría reutilizarse en upload-post/crm. **No se define aquí** — proponer al PRD base.
**Recomendación**: abrir issue/PR al PRD base para añadir estos 2 componentes al catálogo. Mientras, affiliate los implementa inline (justificado — no existe base).
**Impacto si no se resuelve**: no bloqueante para este PRD. Deuda técnica menor.
**Estado**: pendiente agregar al PRD base.

## Q-010 — Cookie window duration
**Pregunta**: ¿cuánto dura la cookie de referido (`?ref=AFF-XXXXXX`) antes de expirar?
**Estado actual**: no hay tracking de cookie/landing implementado — el referral se crea manualmente (admin o partner via portal).
**Recomendación**: fuera de scope de este PRD (es tracking de conversión web, no UI). Requiere landing page + cookie + middleware. Otro PRD.
**Impacto si no se resuelve**: no bloqueante.
**Estado**: descartado para este PRD.