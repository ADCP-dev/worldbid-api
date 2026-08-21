---
doc: knowledge-agent/05-risks-and-tradeoffs
title: "Knowledge Agent — Riesgos y Trade-offs"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Riesgos y Trade-offs

## Riesgos

| ID  | Riesgo                                              | Probabilidad | Impacto | Mitigación                                                                  |
|-----|-----------------------------------------------------|--------------|---------|-----------------------------------------------------------------------------|
| R-01 | El agente elimine notas importantes                 | Media        | Alto    | Soft delete (`deleted_at` + `deleted_by`) + auditoría. Considerar human-in-the-loop para delete (deferible a v2, ver Q-02). |
| R-02 | Cross-user session leakage                         | Baja         | Crítico | `user_id` filter en todas las queries + verificar ownership en cada endpoint (403). Row-level security de PostgreSQL como defense-in-depth (ver Q-03). |
| R-03 | Sandbox Node VFS menos aislado que microVM          | Media        | Alto    | Permisos declarativos allow/deny + glob paths + working dir aislado por session. El agente no puede escapar del working dir permitido. Deny a `.env`, creds, código del proyecto. |
| R-04 | pgvector performance a escala                       | Baja         | Medio   | Index IVFFlat o HNSW. Suficiente para KB interna (< 10k notas).              |
| R-05 | SVG rendering con d3-force lento para > 1000 nodos | Media        | Bajo    | Suficiente para KB interna. Si escala, evaluar canvas/WebGL (ver Q-09 abierto). |
| R-06 | langchainjs gaps (langgraph-supervisor npm no verificado) | Baja    | Bajo    | No necesario: agente único con tools (no orquestador + subagentes).         |
| R-07 | Nombres de paquetes npm LangChain no confirmados    | Media        | Medio   | Verificar `@langchain/mcp-adapters` y `@langchain/langgraph-checkpoint-postgres` en npm antes de Fase 3 (ver Q-06). |
| R-08 | Ollama Cloud URL/base desconocida                   | Media        | Medio   | Confirmar endpoint antes de Fase 3 (ver Q-07).                              |
| R-09 | Agent.md dinámico requiere reconstrucción del agente | Media        | Bajo    | Cache por config hash, reconstruir solo si config cambia.                   |
| R-10 | LTREE puede no estar instalado en PostgreSQL         | Media        | Bajo    | Fallback a path string indexado con GIN/GiST (ver Q-01).                     |

## Trade-offs decididos

| ID  | Decisión                                             | Qué se sacrifica                              | Qué se gana                                    | Por qué                                          |
|-----|------------------------------------------------------|-----------------------------------------------|------------------------------------------------|--------------------------------------------------|
| T-01 | Agente único con tools vs orquestador + subagentes  | Paralelismo, especialización de subagentes    | Menos tokens, más simple, cero coordinación    | KB interna no necesita orquestación compleja     |
| T-02 | pgvector en PostgreSQL vs Qdrant separado            | Performance dedicada de vector DB            | Sin infra extra, sin servicio que mantener      | KB interna < 10k notas no justifica Qdrant       |
| T-03 | RAG como tool vs automático                          | Contexto automático en cada query             | Agente decide cuándo buscar (menos coste, más control) | RAG automático ensucia contexto innecesario      |
| T-04 | Node VFS vs sandbox externo (Daytona/Modal/E2B)     | Aislamiento de microVM real                   | Cero infra externa, dev + prod uniformes       | Comandos del agente son livianos, no necesitan microVM |
| T-05 | d3-force vs vue-flow/cytoscape                       | Declaratividad de vue-flow, plugins de cytoscape | Port directo de demo del usuario, control total sobre SVG | El usuario ya tiene demo en React + d3-force      |
| T-06 | Tools nativas in-process vs MCP para todo            | Estandarización universal vía MCP             | Cero overhead, sin protocolo, in-process      | Tools internas no necesitan MCP; MCP solo para externos |
| T-07 | Soft delete vs hard delete                           | Espacio en DB, necesidad de purge policy      | Recuperabilidad, auditoría, historial         | Notas eliminadas por agente pueden ser críticas   |

### Notas sobre trade-offs

- **T-01** es la decisión más estructural: define que la extensión NO implementa
  un orquestador. Cada extensión aporta tools, no subagentes. Esto reduce
  complejidad y tokens de coordinación.
- **T-04** refinea la decisión previa en memoria (#856 decía "Node VFS dev +
  Daytona prod"). Se decide **Node VFS para todo** (Q-04 resuelto) porque los
  comandos del agente son livianos y no justifican infra externa.
- **T-05** se basa en que el usuario ya tiene una demo React + d3-force que
  quiere portar a Vue 3. No se elige vue-flow por declaratividad ni cytoscape
  por plugins: se elige d3-force por control total sobre el SVG y port
  directo.