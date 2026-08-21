---
doc: agent-native/00-index
title: "Foundation Agent-Native — Índice"
status: draft
created: 2026-08-19
---

# Foundation Agent-Native — PRD Maestro

## Metadata

| Campo | Valor |
|-------|-------|
| Slug | `agent-native` |
| Estado | draft |
| Creado | 2026-08-19 |
| Alcance | Evolución de Foundation hacia plataforma agent-native completa |
| Base | Foundation mono repo (NestJS + Nuxt + TypeORM + PostgreSQL) |

## Contexto

Foundation es la base de toda app de SOM-OS. Tiene ~87K LOC de app + ~13K LOC de framework custom (spec engine). El spec engine ya materializa CRUD, hooks, jobs, notificaciones, webhooks, y acciones custom desde YAML. Las extensions son auto-discovered.

El siguiente paso es hacer que Foundation sea **agent-native de pies a cabeza**: que un agente de coding pueda operar toda la plataforma sin leer código fuente, que los errores sean accionables automáticamente, y que las features que faltan (realtime, vector, branching) se integren en el spec engine.

## Tabla de contenidos

| # | Archivo | Tema | Prioridad |
|---|---------|------|-----------|
| 00 | `00-index.md` | Este índice + metadata + grafo dependencias | — |
| 01 | `01-structured-actionable-errors.md` | Errors con contexto accionable para agentes | P0 |
| 02 | `02-mcp-introspection-server.md` | MCP server para ver la app entera sin código | P0 |
| 03 | `03-auto-generated-skills.md` | Skills auto-generados por extensión | P1 |
| 04 | `04-database-branching.md` | Branches efímeros de DB para agentes | P1 |
| 05 | `05-realtime-listen-notify.md` | Realtime via Postgres LISTEN/NOTIFY | P2 |
| 06 | `06-pgvector-integration.md` | Vector search en spec engine | P2 |
| 07 | `07-mandatory-guards.md` | Guards obligatorios en spec engine | P1 |
| 08 | `08-error-tracker-auto-fix.md` | Error tracker → auto-fix de bugs | P1 |
| 09 | `09-admin-viewer.md` | Pantallas admin: stack trace viewer, trace viewer, app overview | P1 |

## Principios de diseño

1. **Spec engine es SSOT** — toda feature nueva se modela en spec.types.ts y se materializa desde YAML
2. **Agent-first** — toda operación devuelve JSON structured que un agente puede parsear
3. **Sin dependencias externas innecesarias** — usar Postgres features nativas (LISTEN/NOTIFY, pgvector, schemas) antes que añadir servicios
4. **No romper extensions existentes** — CRM, Tasks, CMS, Stripe siguen funcionando sin cambios
5. **Trazabilidad** — cada operación del agente queda registrada y reversible

## Grafo de dependencias

```
PRD 07 (Mandatory Guards)     PRD 01 (Actionable Errors)
        │                            │
        │                            ▼
        │                       PRD 08 (Auto-Fix)
        │                            │
        │                       PRD 04 (DB Branching)
        │                            │
        ▼                            ▼
PRD 02 (MCP Introspection) ◄─── (usa 01, 07; 04 opcional)
        │                    │
        │                    │
        ▼                    ▼
PRD 03 (Auto-Gen Skills)  PRD 09 (Admin Viewer)
  (usa 02)                  (usa 02, 01, 08)

Independientes:
PRD 05 (Realtime)    — no depende de otros
PRD 06 (pgvector)    — no depende de otros
```

### Dependencias detalladas

| PRD | Depende de | Por qué |
|-----|-----------|---------|
| 01 | — | Base de todo. Sin errors structured, no hay nada |
| 02 | 01 (enriquecido), 07 (guards en list_routes) | El MCP usa ActionableError en get_errors, y usa guards validados en list_routes. La integración con DB branching (04) es opcional — las tools de branch son un add-on |
| 03 | 02 | Los skills complementan al MCP. El MCP es la fuente de verdad runtime; el skill es el resumen estático que el agente carga al inicio |
| 04 | — | DB branching es autónomo |
| 05 | — | Realtime es autónomo |
| 06 | — | pgvector es autónomo |
| 07 | — | Guards es autónomo (pero el MCP se enriquece cuando está activo) |
| 08 | 01 (suggestedFix), 04 (test en branch aislada) | Auto-fix necesita errors structured para saber qué fixear, y DB branching para testear sin riesgo |
| 09 | 02 (HTTP endpoints), 01 (ActionableError), 08 (auto-fix history) | El admin viewer consume los mismos endpoints MCP que el agente. Sin PRD 02 no hay datos. Sin PRD 01 no hay category/suggestedFix/trace. Sin PRD 08 no hay Fix tab ni auto-fix history |

## Orden de implementación

### Fase 0: Fundaciones (sin dependencias)

1. **PRD 07** — Mandatory guards. Es lo más simple y lo más seguro. Rechazar specs sin permissions. Implementar primero porque protege todo lo demás.
2. **PRD 01** — Structured actionable errors. Base de auto-fix y MCP. Sin esto, nada del resto tiene contexto accionable.

### Fase 1: Infraestructura para agentes

3. **PRD 04** — Database branching. Necesario para que auto-fix (PRD 08) pueda testear aislado.
4. **PRD 02** — MCP introspection server. La pieza que multiplica velocidad de programación. Depende de 01 y 07 para datos enriquecidos, y de 04 para tools de branch.

### Fase 2: Automatización

5. **PRD 08** — Auto-fix engine. Depende de 01 (suggestedFix) y 04 (test en branch).
6. **PRD 03** — Skills auto-generados. Depende de 02 para no duplicar datos. Es el resumen estático que complementa al MCP dinámico.
7. **PRD 09** — Admin Viewer. Depende de 02 (HTTP endpoints), 01 (ActionableError), y 08 (auto-fix history). Es la cara visible para el dueño de la app.

### Fase 3: Features de producto

8. **PRD 05** — Realtime. Autónomo, pero solo se implementa cuando haya una app de cliente que lo necesite.
9. **PRD 06** — pgvector. Autónomo, pero solo se implementa cuando haya un caso de uso de IA que lo requiera.

## Testing strategy

Cada PRD debe incluir tests específicos. Estrategia general:

### Unit tests

- **PRD 01**: Test de cada heurística de `inferSuggestedFix` con errores reales
- **PRD 07**: Test de validator con specs válidos e inválidos (sin permissions, con permissions parciales)
- **PRD 02**: Test de cada introspector con mocks del SpecLoader/DB

### Integration tests

- **PRD 04**: Test del ciclo completo: create branch → apply migration → verify public intacto → discard
- **PRD 05**: Test del flujo completo: INSERT → trigger → LISTEN → gateway → cliente WebSocket
- **PRD 08**: Test del ciclo completo: error → suggestedFix → testChanges en branch → apply → error resuelto

### E2E tests (con agente real)

- **PRD 02**: Un agente (Claude Code o Cursor) usa el MCP para descubrir rutas y operar la app sin leer código
- **PRD 03**: Un agente carga un skill auto-generado y opera la extensión sin errores de contexto
- **PRD 08**: Un error real del spec engine se auto-fixea sin intervención humana
- **PRD 09**: El admin abre /admin/overview, ve el resumen, navega a un error, ve el stack trace navegable, revisa el pipeline trace, acepta un fix sugerido

### Regresión

- Extensions existentes (CRM, Tasks, CMS, Stripe) deben seguir funcionando después de cada PRD
- `pnpm spec:validate` debe pasar en todos los specs existentes
- `pnpm test` debe pasar sin cambios en tests existentes