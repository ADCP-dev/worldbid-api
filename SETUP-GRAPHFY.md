# Graphify Setup — Manual Steps

Python is not installed on this machine and is required for Graphify.
Run these commands once Python is available:

## 1. Install Python 3.10+

```powershell
# Option A: winget (Windows)
winget install Python.Python.3.12

# Option B: Manual download
# https://www.python.org/downloads/
```

## 2. Install Graphify

```powershell
pip install graphifyy
```

## 3. Install OpenCode integration

```powershell
graphify opencode install
```

This creates:
- `.opencode/plugins/graphify.js` — always-on plugin
- `opencode.json` — plugin registration

## 4. Build the first knowledge graph

```powershell
graphify ./docs --out graphify-out
```

This generates:
- `graphify-out/GRAPH_REPORT.md` — god nodes, connections, questions
- `graphify-out/graph.json` — persistent graph
- `graphify-out/graph.html` — interactive visualization

## 5. Install git hooks

```powershell
graphify hook install
```

## 6. Sync with Obsidian (optional)

```powershell
pnpm obsidian:sync ~/Documents/Obsidian/Empresa
```

---

Config files already created:
- `.graphifyignore` — exclusion patterns for the graph
- `bin/sync-obsidian.js` — script to merge Obsidian vault with project graph
- `.gitignore` — updated with graphify cache exclusions
- `package.json` — includes `"obsidian:sync"` script
