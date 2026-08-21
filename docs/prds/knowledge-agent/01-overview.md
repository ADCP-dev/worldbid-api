---
doc: knowledge-agent/01-overview
title: "Overview"
status: draft
created: 2026-08-21
---

# Overview

## Resumen ejecutivo

Extensión **knowledge-agent** nueva (greenfield). Sistema de conocimiento en markdown viviente en PostgreSQL con embedding pgvector para RAG, un DeepAgent (npm `deepagents` sobre LangGraph) con agente único que acumula tools de todas las extensiones del monorepo, agent.md dinámico en DB, sandbox de comandos aislados, MCPs externos configurables, modelo/proveedor configurable en DB (Ollama Cloud + OpenRouter), y chat con sesiones persistentes estilo ChatGPT con streaming SSE y render rich. Visores estilo Obsidian: árbol jerárquico + grafo de nodos/links/backlinks.

## Problema / motivación

1. **Conocimiento fragmentado y no consultable**: las notas/vistas del equipo viven en archivos sueltos, sin búsqueda semántica, sin grafo de relaciones, sin backlinks. Encontrar "dónde se decidió X" requiere archaeology manual.
2. **Sin agente que opere sobre el conocimiento**: no hay un agente con acceso al knowledge base + tools del proyecto + tools externos (MCP) que pueda responder preguntas, ejecutar comandos aislados, y mantener sesiones de chat persistentes.
3. **Configuración de agentes hardcodeada**: los agent prompts y configuración de modelo/proveedor viven en archivos fijos. Cambiar de Ollama a OpenRouter o actualizar el system prompt requiere deploy.
4. **Sin sandbox para comandos del agente**: el agente no puede ejecutar `curl`, scripts de math, o comandos utilitarios sin riesgo de tocar el código del proyecto.

## Objetivos

- **O-01 — Knowledge base en DB**: almacenar notas markdown en PostgreSQL (`ext_ka_notes`) con frontmatter OKF (YAML: type, title, description, tags, sources, generated, okf_version), contenido editable con TipTap, embedding pgvector(1536) para RAG.
- **O-02 — Visores estilo Obsidian**: sidebar jerárquico (árbol de notas por tags/categorías) + visor de grafo (nodos = notas, edges = links `[[]]`, backlinks reversibles via query SQL).
- **O-03 — DeepAgent con `deepagents`**: agente único (NO orquestador+subagentes) con `createDeepAgent`, system prompt dinámico desde DB (`ext_ka_agent_configs`), modelo configurable via string `"provider:model"`.
- **O-04 — Tools de extensiones auto-discovered**: cada extensión puede exportar tools en archivo convención (`<extension>/agent.tools.ts` → array de LangChain tools). Orchestrator module colecciona via glob auto-discovery (mismo patrón que `ExtensionLoaderModule`). Tools se mergean en el agente.
- **O-05 — Sandbox de comandos aislados**: `execute` tool con SandboxBackend. Node VFS (dev) + Daytona (prod). Permisos declarativos deny a `.env`, creds, código del proyecto. `isolated-vm` para eval liviano (math/scripts).
- **O-06 — MCPs externos configurables**: tabla `ext_ka_mcp_servers` (name, transport, url, api_key_ref). `MultiServerMCPClient` carga servers al construir agente. Tools de MCP se mergean con tools custom.
- **O-07 — Chat con sesiones**: `PostgresSaver` checkpointer = sesiones persistentes en PostgreSQL (`ext_ka_chat_sessions`). Streaming SSE desde NestJS hacia Nuxt. Render rich: `markdown-it` + `highlight.js` + `DOMPurify`.
- **O-08 — Config en DB**: tablas `ext_ka_model_providers` (provider enum, api_key_ref, base_url) y `ext_ka_models` (provider_id, model_id, display_name, context_window, active). Frontend cambia modelo/proveedor por agente.

### Criterios de éxito medibles

- Nota nueva creada → embedding generado < 2s (nota de 5k chars).
- Búsqueda semántica RAG retorna top-5 notas relevantes < 500ms sobre 10k notas.
- Grafo de 500 nodos renderiza < 1s (vue-flow o cytoscape).
- Chat: primer token del stream SSE < 3s (Ollama Cloud) / < 2s (OpenRouter).
- Agente construido desde DB config (system prompt + tools + model) < 1s con cache hit.
- Sandbox ejecuta `curl https://api.example.com` y retorna response sin tocar filesystem del proyecto.

## No-objetivos

- **NO** orquestador + subagentes (patrón supervisor). Agente único que acumula tools. [NEEDS CLARIFICATION: ver Q-01 si surge necesidad de multi-agente]
- **NO** storage de notas en archivos `.md` del repo. Todo en PostgreSQL.
- **NO** usar OpenWiki CLI como dependencia runtime. Solo tomamos el formato OKF (YAML frontmatter). [NEEDS CLARIFICATION: ver Q-02]
- **NO** Agent Server API de LangGraph Platform. Usamos `PostgresSaver` directo + nuestro SSE endpoint en NestJS.
- **NO** soporte de voice/multimodal input en chat v1.
- **NO** multi-tenant knowledge bases (single shared KB en v1). [NEEDS CLARIFICATION: ver Q-03]
- **NO** fine-tuning de embeddings models. Usamos `OllamaEmbeddings` pre-entrenados.
- **NO** sincronización bidireccional con Obsidian/Notion/externos en v1.
- **NO** hot-swap de agente en runtime. Se reconstruye por request con cache por config hash.

## KPIs

| KPI | Target | Medición |
|-----|--------|----------|
| Time-to-embed nota nueva | < 2s | 5k chars nota |
| Latencia búsqueda semántica | < 500ms | 10k notas dataset |
| Grafo render time | < 1s | 500 nodos |
| Chat first-token latency | < 3s (Ollama) / < 2s (OpenRouter) | SSE stream |
| Agent build from config | < 1s | Cache hit |
| Sandbox isolation | 100% | No filesystem leaks al proyecto |