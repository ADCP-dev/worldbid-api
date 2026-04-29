---
name: graph-query
description: >
  Query the Foundation knowledge graph (graphify-out/graph.json) for code architecture questions.
  Trigger: When user asks about architecture, dependencies, "how does X connect to Y", "show me the path",
  "graph query", "what depends on", or wants to explore the codebase structure.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- "¿Cómo funciona el flujo de auth?" → `graph-query.py auth guard decorator --depth 2`
- "¿Qué módulos dependen de Storage?" → `graph-query.py FileEntity storage --depth 2`
- "¿Cómo llega una request de auth a file?" → `graph-query.py AuthService FileEntity --mode path`
- "Dame stats del grafo" → `graph-query.py --mode stats`
- "¿Qué hay sobre email?" → `graph-query.py email mail queue --mode explain`

## Critical Patterns

- **Siempre usar `python bin/graph-query.py`** — no `graphify query` (el CLI built-in no tiene imports @)
- **BFS (default) para explorar** — "¿qué está conectado a X?"
- **Path mode para dependencias** — "¿cómo llega X a Y?"
- **Stats mode para overview** — ver total de nodos/edges/relaciones
- El grafo ya incluye imports con alias `@` (back + front) gracias a `bin/enrich-graph.py`

## Modes

| Flag | Mode | Cuándo |
|---|---|---|
| _(default)_ | BFS depth=3 | Explorar contexto amplio |
| `--mode dfs --depth 5` | DFS | Trazar cadena de dependencias |
| `--mode path` | Shortest path | Conectar dos conceptos |
| `--mode explain` | List nodes | Buscar archivos/clases por nombre |
| `--mode stats` | Stats | Ver estado del grafo |
| `--depth N` | Control depth | Más profundo = más contexto |

## Commands

```bash
# BFS: explorar qué hay alrededor de un concepto
python bin/graph-query.py auth guard decorator --depth 2

# Path: shortest path entre dos módulos
python bin/graph-query.py AuthService FileEntity --mode path

# Explain: listar nodos que matchean
python bin/graph-query.py email mail queue --mode explain

# Stats: total de nodos y edges
python bin/graph-query.py --mode stats

# DFS: trazar cadena profunda
python bin/graph-query.py auth jwt strategy --mode dfs --depth 5
```

## Rebuilding the Graph

Solo cuando hay cambios grandes de código (nuevos archivos, refactors):

```bash
# 1. Build graph with graphify (AST extraction, free)
graphify .

# 2. Add @ alias imports (reads tsconfig.json + nuxt.config.ts dynamically)
python bin/enrich-graph.py
```

El agente NUNCA debe ejecutar estos durante queries normales. Solo cuando el usuario pide explícitamente "actualizá el grafo".

## Graph Structure

- **Nodes**: archivos, clases, funciones, métodos (con `source_file` y `label`)
- **Edges**: `imports_from`, `calls`, `contains`, `method`
- **Backend aliases**: `@iam`, `@users`, `@storage`, `@infra`, `@comms`, `@billing`, `@social`, `@core`, `@src`, `@ext`
- **Frontend aliases**: `@`, `@base`, `@cms`, `@landing`, `@auth`, `@translations`, `@error-tracker`, `@ui-app`

## Limitations

- **Front ↔ Back no linkeados**: `fetchWrapper.get('/users')` no apunta a `UsersController`. Los grafos son silos separados.
- **Nuxt auto-imports**: componentes/composables auto-importados no generan edges (no hay `import` explícito)
- **Solo code**: solo archivos fuente, no dependencias de paquetes npm
