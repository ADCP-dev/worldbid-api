---
doc: knowledge-agent/07-open-questions
title: "Knowledge Agent — Open Questions"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Open Questions

## Resueltas

| ID  | Pregunta                                              | Decisión                                                                       | Razón                                              |
|-----|-------------------------------------------------------|--------------------------------------------------------------------------------|----------------------------------------------------|
| Q-04 | ¿Sandbox prod?                                        | Node VFS para todo (dev + prod). Sin sandbox externo.                           | Comandos del agente son livianos, no justifican infra externa. |
| Q-05 | ¿Librería para visor grafo?                           | `d3-force` (port de demo del usuario a Vue 3).                                  | El usuario ya tiene demo React + d3-force. Control total sobre SVG. |
| Q-14 | ¿RAG automático vs tool?                              | Tool opt-in. Dos tools: `search_notes_tree` (tree search) + `search_notes_semantic` (pgvector). | RAG automático ensucia contexto innecesario. El agente decide cuándo buscar. |
| Q-15 | ¿Tools nativas vs MCP para extensiones internas?      | Nativas para extensiones internas (`agent.tools.ts` auto-discovery). MCP solo para externos. | Tools internas in-process = cero overhead. MCP solo agrega valor para servicios de terceros. |

## Abiertas

| ID  | Pregunta                                                | Impacto     | Recomendación del agente                                                  |
|-----|---------------------------------------------------------|-------------|---------------------------------------------------------------------------|
| Q-01 | ¿LTREE vs path string para `category_path`?             | No-bloqueante | LTREE si está disponible (queries nativas). Fallback a path string indexado con GIN/GiST. Verificar disponibilidad en Fase 1. |
| Q-02 | ¿Soft delete requiere human-in-the-loop para delete del agente? | No-bloqueante | Soft delete + auditoría (`deleted_at` + `deleted_by`). HITL deferible a v2 — el soft delete ya permite recuperación. |
| Q-03 | ¿Row-level security de PostgreSQL para session isolation o solo app-level? | No-bloqueante | App-level (verificar ownership en cada endpoint, 403). Considerar RLS como defense-in-depth. No bloqueante para Fase 5. |
| Q-06 | ¿Nombres exactos de paquetes npm LangChain?              | Bloqueante (Fase 3) | Verificar `@langchain/mcp-adapters` y `@langchain/langgraph-checkpoint-postgres` en npm antes de Fase 3. |
| Q-07 | ¿URL/base de Ollama Cloud?                               | Bloqueante (Fase 3) | Confirmar endpoint antes de Fase 3.                                      |
| Q-08 | ¿Compatibilidad Node.js de todos los paquetes nuevos?    | Bloqueante (Fase 3) | Verificar compat con Node.js del proyecto en Fase 3 al instalar.         |
| Q-09 | ¿Canvas/WebGL si grafo escala > 1000 nodos?              | No-bloqueante | Deferir. SVG suficiente para KB interna (< 10k notas, grafo típico < 500 nodos visibles). |
| Q-10 | ¿TipTap extensions necesarias?                          | No-bloqueante | Definir en Fase 1. Mínimo: starter-kit. A evaluar: code-block-lowlight, link, table. |

### Notas

- **Q-04** refine la decisión previa en memoria (#856 decía "Node VFS dev +
  Daytona prod"). Ahora es **Node VFS para todo** — sin sandbox externo.
- Las preguntas bloqueantes (Q-06, Q-07, Q-08) se resuelven al inicio de Fase 3,
  antes de instalar dependencias.
- Las no-bloqueantes pueden resolverse durante la implementación sin detener
  el avance.