---
name: graph-query
description: |
  Query the Foundation knowledge graph (graphify-out/graph.json) for code architecture questions.
  Also: build/rebuild the graph from source code.
  Trigger: When user asks about architecture, dependencies, "how does X connect to Y", "show me the path",
  "graph query", "what depends on", or wants to explore the codebase structure.
---

## Building the Graph

When user says "actualizá el grafo" or "rebuild graph":

```bash
# 1. AST extraction (free)
graphify .

# 2. Add @ alias imports (reads tsconfigs + nuxt.config dynamically)
python bin/enrich-graph.py
```

## Querying the Graph

**Siempre usar `python bin/graph-query.py`** — no `graphify query` (faltan imports @)

| Mode | Flag | Best for |
|------|------|----------|
| BFS (default) | `--depth N` | "¿Qué está conectado a X?" — contexto amplio |
| DFS | `--mode dfs --depth 5` | Trazar cadena de dependencias |
| Path | `--mode path` | "¿Cómo llega X a Y?" |
| Explain | `--mode explain` | Buscar archivos/clases por nombre |
| Stats | `--mode stats` | Ver estado del grafo |

### Examples

```bash
python bin/graph-query.py auth guard decorator --depth 2
python bin/graph-query.py AuthService FileEntity --mode path
python bin/graph-query.py email mail queue --mode explain
python bin/graph-query.py --mode stats
python bin/graph-query.py auth jwt strategy --mode dfs --depth 5
```

## Graph Structure

- **Nodes**: archivos, clases, funciones, métodos (con `source_file`, `label`)
- **Edges**: `imports_from`, `calls`, `contains`, `method`
- **Backend aliases**: `@iam`, `@users`, `@storage`, `@infra`, `@comms`, `@billing`, `@social`, `@core`, `@src`, `@ext`
- **Frontend aliases**: `@`, `@base`, `@cms`, `@landing`, `@auth`, `@translations`, `@error-tracker`, `@ui-app`

## Limitations

- **Front ↔ Back no linkeados**: fetch vs controller no se conectan
- **Nuxt auto-imports**: componentes sin import explícito no generan edges
- **Solo code**: no dependencias npm
- Graph in `graphify-out/graph.json`
