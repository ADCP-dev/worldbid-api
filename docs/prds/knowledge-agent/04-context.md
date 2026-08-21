---
doc: knowledge-agent/04-context
title: "Contexto"
status: draft
created: 2026-08-21
---

# Contexto

## Stack actual

### Backend
- NestJS + TypeORM + PostgreSQL + Bull (queues)
- Extensiones auto-discovered en `apps/back/src/extensions/`
- Path alias: `@ext/knowledge-agent/*`, `@iam/*`, `@users/*`, `@infra/*`, `@src/*`
- NestJS `Logger` — nunca `console.log`

### Frontend
- Nuxt 3 + Vue 3 + DaisyUI + Tailwind + Pinia + TanStack Query
- Extensiones en `apps/front/extensions/`
- Path alias: `@ka` → `apps/front/extensions/knowledge-agent` [NEEDS CLARIFICATION: convención de alias — ver Q-07]
- `@base/ui-app/components/` — `FormInput`, `FormSelect`, `DataTable`, `RichEditor`, etc.

### Convenciones del proyecto

| Convención | Regla |
|------------|-------|
| Tablas extensión | Prefijo `ext_ka_` (knowledge-agent) |
| Path alias back | `@ext/knowledge-agent/*` |
| Path alias front | `@ka/*` [NEEDS CLARIFICATION: ver Q-07] |
| Entity discovery | TypeORM glob `**/*.entity{.ts,.js}` — automático |
| Module discovery | `extension.module.ts` auto-cargado por `ExtensionLoaderModule` |
| Logs | NestJS `Logger` — nunca `console.log` |
| Imports | Alias absolutos, nunca relativas largas |
| `import type` | Para tipos only |
| Migraciones | `pnpm migration:generate` + `pnpm migration:run` — nunca SQL a mano |
| Front forms | Zod + `@base/ui-app` form components |
| Front tables | `DataTable` base + TanStack Vue Table |
| Generadores | Hygen — `pnpm generate:extension` para scaffold inicial |

## Dependencias

### Internas (extensiones/módulos)
- `auth` — JWT, UsersService, RolesGuard, `@Roles(RoleEnum.admin)`
- Ninguna otra extensión es dependencia directa. Las tools de otras extensiones se coleccionan via auto-discovery (FR-305), no via import directo.

### Externas (npm) — nuevas a añadir

| Paquete | Propósito | Estado |
|---------|-----------|--------|
| `deepagents` | Agent harness sobre LangGraph. `createDeepAgent`, SandboxBackend, filesystem. | [NEEDS CLARIFICATION: versión v0.7+ — verificar compatibilidad Node.js. ver Q-08] |
| `@langchain/core` | LangChain core (tools, messages). | Dep de deepagents |
| `@langchain/langgraph` | LangGraph (graph, checkpointer, streaming). | Dep de deepagents |
| `@langchain/mcp-adapters` | `MultiServerMCPClient` para MCP externos. | [NEEDS CLARIFICATION: nombre exacto del paquete npm — ver Q-09] |
| `@langchain/community` | `PGVectorStore`, `OllamaEmbeddings`, chat model integrations. | |
| `pgvector` | PostgreSQL extension para vector storage. | Extensión DB, no npm |
| `markdown-it` | Render markdown en frontend chat. | Front |
| `highlight.js` | Syntax highlighting code blocks en chat. | Front |
| `dompurify` | HTML sanitization en chat render. | Front |
| `vue-flow` o `cytoscape` | Visor de grafo. | [NEEDS CLARIFICATION: cuál — ver Q-05] |
| `isolated-vm` | QuickJS sandbox para eval liviano. | Backend (native addon) |
| `@langchain/langgraph-checkpoint-postgres` | `PostgresSaver` checkpointer. | [NEEDS CLARIFICATION: nombre exacto — ver Q-09] |

### APIs externas
- **Ollama Cloud** — `https://api.ollama.cloud` [NEEDS CLARIFICATION: URL exacta — ver Q-10]
- **OpenRouter** — `https://openrouter.ai/api/v1`
- **MCP servers externos** — URLs configurables en DB

### Extensiones PostgreSQL requeridas
- `pgvector` — debe estar instalada y habilitada en la DB. `CREATE EXTENSION IF NOT EXISTS vector;` en migración.

## Constraints (three-tier)

| Tier | Constraint |
|------|-----------|
| ✅ Always | Mantener auto-discovery (no tocar `app.module.ts`) |
| ✅ Always | Tabla prefix `ext_ka_` para todas las tablas nuevas |
| ✅ Always | Migraciones vía TypeORM CLI (`pnpm migration:generate` + `pnpm migration:run`) |
| ✅ Always | API keys via env vars, nunca hardcode. DB guarda `api_key_ref` (nombre var), no valor |
| ✅ Always | `RichEditor` base para editor de notas — no custom TipTap desde cero |
| ✅ Always | `DataTable` base para listas — no custom table |
| ✅ Always | Form components base (`FormInput`, `FormSelect`, `FormSwitch`) — no custom |
| ✅ Always | Agente único, no orquestador + subagentes |
| ✅ Always | Sandbox deny a `.env`, creds, `apps/`, `packages/`, `src/` |
| ✅ Always | PostgresSaver para persistencia de sesiones (no MemorySaver) |
| ✅ Always | SSE para streaming (no WebSocket) |
| ⚠️ Ask first | Añadir deps npm: `deepagents`, `@langchain/*`, `markdown-it`, `highlight.js`, `dompurify`, `isolated-vm`, `vue-flow`/`cytoscape` |
| ⚠️ Ask first | Instalar extensión `pgvector` en PostgreSQL (requiere access DB admin) |
| ⚠️ Ask first | Daytona sandbox en prod (requiere cuenta + configuración) — ver Q-04 |
| 🚫 Never | Modificar `app.module.ts` |
| 🚫 Never | Hardcodear API keys, secrets, URLs de API |
| 🚫 Never | Guardar contenido de notas en archivos `.md` del repo — todo en PostgreSQL |
| 🚫 Never | Usar OpenWiki CLI como dependencia runtime |
| 🚫 Never | `console.log` — usar `Logger` |
| 🚫 Never | Rutas relativas largas — usar aliases |
| 🚫 Never | Escribir entity/service/controller a mano — usar Hygen generators para scaffold |
| 🚫 Never | SQL DDL a mano — migraciones CLI |
| 🚫 Never | `any` type — usar `unknown` + guards |
| 🚫 Never | Permitir sandbox acceso a código del proyecto o creds |
| 🚫 Never | Hot-swap de agente en runtime — reconstruir por request |

## Supuestos asumidos

| Supuesto | Razón |
|----------|-------|
| `pgvector` disponible en PostgreSQL | Extensión estándar, ampliamente soportada. Si no está, se instala. |
| `deepagents` v0.7+ compatible con Node.js del proyecto | LangChain JS soporta Node 18+. Verificar en Q-08. |
| Ollama Cloud URL y API estables | Brief del usuario indica Ollama Cloud. URL exacta a confirmar (Q-10). |
| OpenRouter API compatible con langchainjs | LangChain JS tiene integración OpenRouter. |
| `PostgresSaver` disponible en langchainjs | Brief indica que sí. Nombre exacto del paquete a confirmar (Q-09). |
| Single shared knowledge base | No multi-tenant en v1 (Q-03). |
| `vue-flow` o `cytoscape` suficiente para grafo de < 1000 nodos | Escala razonable para KB interna. |
| Sandbox Node VFS suficiente para dev | deepagents lo soporta. |
| `isolated-vm` instalable como native addon | Requiere build tools. Si falla, fallback a `vm` module de Node (menos seguro). [NEEDS CLARIFICATION: ver Q-11] |
| Formato OKF de OpenWiki es estable | Inspirado en OpenWiki. Si OKF evoluciona, adaptar frontmatter. |