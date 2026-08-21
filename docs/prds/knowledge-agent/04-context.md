---
doc: knowledge-agent/04-context
title: "Knowledge Agent — Contexto"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Contexto

## Stack actual

- **Backend**: NestJS + TypeORM + PostgreSQL + Bull (queues) + Nodemailer
- **Frontend**: Nuxt 3 + Vue 3 + DaisyUI + Tailwind CSS + Pinia + TanStack Query
  + Nuxt Layers
- **Monorepo**: Turborepo
- **Arquitectura**: Clean/Hexagonal, modular extensions (copy-paste pattern)

Stack nuevo que incorpora esta extensión:

- **Backend IA**: langchainjs (`deepagents` npm) + pgvector + LangGraph
  (`PostgresSaver`) + `isolated-vm`
- **Frontend visores/editor**: TipTap + `d3-force` + `d3-selection` +
  `d3-zoom` + `markdown-it` + `highlight.js` + `dompurify`

## Aliases

| Alias                  | Destino                                        |
|------------------------|------------------------------------------------|
| `@ext/knowledge-agent/*` | `src/extensions/knowledge-agent/*` (backend) |
| `@iam/*`               | `src/modules/iam/*` (auth dependency)         |
| `@infra/*`             | `src/infrastructure/*`                         |
| `@base` (frontend)     | `apps/front/modules/base`                     |
| `@knowledge` (frontend) | `apps/front/modules/knowledge` (Nuxt layer)  |

## Dependencias npm nuevas

### Backend

| Paquete                                          | Propósito                          |
|--------------------------------------------------|------------------------------------|
| `deepagents`                                     | `createDeepAgent` runtime          |
| `@langchain/core`                               | LangChain core (Tool, BaseMessage)  |
| `@langchain/community`                            | `PGVectorStore`, `OllamaEmbeddings`|
| `@langchain/mcp-adapters`                         | `MultiServerMCPClient` [Q-06]      |
| `@langchain/langgraph-checkpoint-postgres`        | `PostgresSaver` checkpointer [Q-06]|
| `isolated-vm`                                    | Eval liviano sin shell/network     |

> Nombres exactos a verificar en npm antes de Fase 3 (ver Q-06).

### Frontend

| Paquete                | Propósito                              |
|------------------------|----------------------------------------|
| `d3-force`             | Force simulation (grafo)              |
| `d3-selection`        | Selección de nodos/links               |
| `d3-zoom`              | Zoom/pan del grafo                     |
| `@tiptap/vue-3`        | Editor rich text                       |
| `@tiptap/starter-kit`  | Bundle base TipTap                     |
| `markdown-it`          | Render markdown en chat                |
| `highlight.js`         | Syntax highlighting en chat            |
| `dompurify`            | Sanitización HTML en render rich       |

> Extensiones TipTap específicas (code-block-lowlight, link, table, etc.) a
> definir en Fase 1 (ver Q-10).

## Convenciones del proyecto

- **Table prefix**: `ext_ka_` en todas las tablas de la extensión (evita
  colisiones con core y otras extensiones).
- **Extension auto-discovery**: carpeta copiada a `src/extensions/` →
  funciona. Módulo se llama `extension.module.ts`. Cero wiring manual.
- **Migrations**: NUNCA hardcode SQL. Siempre `pnpm migration:generate
  <Name>` + `pnpm migration:run` desde `apps/back/`.
- **Generadores Hygen**: para CRUD base usar `pnpm generate:extension` (no
  escribir entity/service/controller a mano).
- **TypeScript**: aliases absolutos, `import type` para solo tipos, nunca
  `any`, `NullableType`/`MaybeType` del proyecto, funciones < 30 líneas.
- **Logger**: NestJS `Logger` (no `console.log`).

## Dependencias (módulos)

- **`auth` (iam)**: user_id, JWT token, RBAC. Dependencia obligatoria.

## Constraints

### ✅ Always

- Usar aliases absolutos (`@ext/knowledge-agent/*`, `@iam/*`, `@infra/*`).
- `import type` para tipos que no se instancian.
- NestJS `Logger` para logs (no `console.log`).
- Funciones < 30 líneas, una responsabilidad.
- Table prefix `ext_ka_` en todas las tablas.
- `user_id` filter en todas las queries de notas y sesiones.
- Verificar ownership en cada endpoint de chat/sesiones.
- Migraciones con `pnpm migration:generate` (no SQL hardcode).
- Soft delete con `deleted_at` + `deleted_by` para notas.

### ⚠️ Ask first

- Instalar dependencias npm nuevas (puede romper algo).
- Instalar extensión `ltree` de PostgreSQL si se usa LTREE para
  `category_path`.
- Instalar extensión `pgvector` de PostgreSQL si no está disponible.

### 🚫 Never

- Escribir `.md` en el repo para knowledge base (todo en PostgreSQL).
- Hardcode SQL DDL (usar `migration:generate`).
- Usar sandbox externo (Daytona/Modal/E2B): solo Node VFS.
- RAG automático sobre cada query: el agente decide cuándo buscar vía tools.
- `console.log` en código backend.
- Usar `any` en TypeScript (usar `unknown` + guards).

## Supuestos asumidos

- **Asumido**: PostgreSQL tiene extensión `pgvector` disponible. Si no →
  instalar antes de Fase 1.
- **Asumido**: Ollama Cloud es accesible desde el backend (endpoint a confirmar,
  ver Q-07).
- **Asumido**: OpenRouter es accesible desde el backend con API key válida.
- **Asumido**: `deepagents` npm tiene paridad JS/TS suficiente con la versión
  Python (confirmado en memoria de sesión previa, ver Q-06 para paquetes).
- **Asumido**: KB interna < 10k notas (no escala a millones — no es objetivo).