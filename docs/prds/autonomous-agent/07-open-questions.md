---
doc: autonomous-agent/07-open-questions
title: "Autonomous Agent — Open Questions"
status: draft
created: 2026-07-07
---

# Open Questions

## Q-001 — Migrar useAutonomousAgent a TanStack Query
**Pregunta**: el composable `useAutonomousAgent.ts` usa `$fetch` directo. ¿Migrar a TanStack Vue Query (que ya está instalado) para caching, refetch, stale-while-revalidate?
**Impacto**: no bloqueante, pero afecta arquitectura del dashboard (loading states manuales vs Query).
**Recomendación**: sí migrar. El resto de extensiones usan Query. Evita refetch al navegar.
**Decisión**: [PENDIENTE]

## Q-002 — Templates de auto-suggest: frontend o backend
**Pregunta**: los templates (`daily`, `weekly`, `aggressive`) se hardcodean en frontend (T-01) o se exponen via `GET /autonomous-agent/defaults` desde el backend?
**Impacto**: no bloqueante. Si backend, añadir endpoint + sincronizar con env defaults.
**Recomendación**: frontend en Fase 3. Si se desincroniza con env custom, mover a backend en una Fase 5.
**Decisión**: [PENDIENTE]

## Q-003 — TimeWindowPicker en este PRD
**Pregunta**: ¿necesitamos TimeWindowPicker (FR-012 base) aquí? El scheduler actual es por cron absoluto, no por ventanas.
**Impacto**: no bloqueante. Si no se usa, omitir de la matriz de uso.
**Recomendación**: omitir en Fase 3. Revisitar si en el futuro se quiere "no ejecutar entre 22:00 y 06:00".
**Decisión**: [PENDIENTE]

## Q-004 — KeyValueEditor para feedbackData
**Pregunta**: ¿exponer `feedbackData` jsonb al admin via KeyValueEditor (FR-020 base) en `[id].vue`?
**Impacto**: no bloqueante. `feedbackData` es system-managed por `FeedbackService`; exponerlo read-only o editable.
**Recomendación**: read-only primero (display en una card "Feedback loop state"). Editable solo si el admin quiere forzar signals — pero eso rompe el feedback loop.
**Decisión**: [PENDIENTE]

## Q-005 — LinkedSelect project → step: ¿B depende de A?
**Pregunta**: en FR-114, los runTypes (B) ¿varían según el proyecto (A)? Hoy todos los runTypes aplican a todos los proyectos.
**Impacto**: bloqueante para FR-114. Si no hay dependencia, usar 2 FormSelect independientes (más honesto).
**Recomendación**: 2 FormSelect independientes. LinkedSelect se reserva para cuando haya tipos de agente por proyecto (Q-008).
**Decisión**: [PENDIENTE]

## Q-006 — Approval flow para acciones destructivas
**Pregunta**: ¿implementar approval flow humano para `publish` y acciones destructivas, más allá del `autoApproveDrafts` actual?
**Impacto**: no bloqueante para este PRD, pero es el riesgo de seguridad principal (R-06). Si se decide sí, va en otro PRD.
**Recomendación**: no en este PRD. Mantener `autoApproveDrafts=false` por defecto + modal de confirmación. Approval flow va en PRD separado si se quiere.
**Decisión**: [PENDIENTE]

## Q-007 — Multi-tenant
**Pregunta**: ¿autonomous-agent es multi-tenant? Hoy `projectId` es un UUID suelto, sin FK a `ext_cp_project` (soft dep). ¿Aislar configs por tenant?
**Impacto**: no bloqueante. Arquitectura de IAM multi-tenant fuera de scope.
**Recomendación**: no en este PRD. Q-007 se resuelve a nivel plataforma, no por extensión.
**Decisión**: [PENDIENTE]

## Q-008 — Tipos de agente
**Pregunta**: ¿soportar tipos de agente más allá de runTypes (research/generate/publish/metrics)? Ej: "SEO agent", "social agent", "blog agent" con configs distintas.
**Impacto**: no bloqueante. Si sí, `ext_aa_config` necesita una columna `agentType` y el form un selector.
**Recomendación**: no en este PRD. Los runTypes actuales cubren el pipeline. Tipos nuevos = extensión nueva o PRD separado.
**Decisión**: [PENDIENTE]

## Q-009 — Timezone del scheduler
**Pregunta**: el `@Cron` del backend corre en UTC por defecto (NestJS). ¿Configurar timezone del scheduler via env (`AUTONOMOUS_AGENT_TZ=Europe/Madrid`)?
**Impacto**: no bloqueante para frontend (CronNextRunsPreview usa tz del navegador). Pero si el admin ve "09:00" y el servidor corre "09:00 UTC = 11:00 Madrid", hay confusión.
**Recomendación**: añadir `AUTONOMOUS_AGENT_TZ` env y pasarlo a `@Cron` options. Mostrar el tz del servidor en el form.
**Decisión**: [PENDIENTE]

## Q-010 — Trigger manual
**Pregunta**: ¿exponer `POST /autonomous-agent/runs/trigger` para que el admin dispare un run manual (sin esperar al cron)?
**Impacto**: no bloqueante. Riesgo R-07 (rate limit). Útil para testing.
**Recomendación**: sí, con rate limit 1/min por configId. Va en Fase 1 o Fase 5.
**Decisión**: [PENDIENTE]

## Q-011 — Costo en USD además de tokens
**Pregunta**: el costo se muestra en tokens. ¿Convertir a USD usando pricing del modelo (`OLLAMA_MODEL=glm-5.2`)?
**Impacto**: no bloqueante. Requiere tabla de pricing o env var.
**Recomendación**: no en este PRD. Tokens es suficiente. USD va con la extensión stripe/billing si se quiere.
**Decisión**: [PENDIENTE]