# Guide for AI Agents - MCP Vector Search

## IMPORTANT: Always Use the MCP Search

This project has a semantic search system called **MCP Vector Search** configured.

### ✅ ALWAYS use MCP tools instead of shell commands

**NEVER use these commands to search code:**

- ❌ `grep`, `find`, `cat`, `ls`, `find . -name`, `rg`, etc.
- ❌ `head`, `tail`, `wc` for counting lines
- ❌ Any command that executes shell/bash/powershell

**ALWAYS use these MCP tools:**

| Tool               | When to Use                          |
| ------------------ | ------------------------------------ |
| `buscar_codigo`    | Search code by meaning (recommended) |
| `stats_index`      | View index statistics                |
| `necesita_reindex` | Check if code is up to date          |

### Examples of Correct Usage

#### ❌ BAD (using shell commands)

```
Looking for the authentication file...
> grep -r "validateLogin" apps/back/src
> cat apps/back/src/modules/iam/auth/auth.service.ts
```

#### ✅ GOOD (using MCP)

```
Looking for the authentication file...
> buscar_codigo(query="login validation logic")
```

### Recommended Workflow

1. **Before any code search**: Use `buscar_codigo` with a natural language description
2. **If you need to know if the index is up to date**: Use `stats_index` or `necesita_reindex`
3. **Only after getting results from MCP**: If you need to see the full file, then read it

### Important Notes

- The index already contains all the code in the project
- Searches are semantic: you can describe what you're looking for instead of knowing the exact name
- It's faster and more accurate than using shell commands

### Need to Re-index?

If the code has changed and results don't seem correct, ask the user if they want to re-index by running:

```
npx tsx mcp-engine/src/cli.ts index --force
```
