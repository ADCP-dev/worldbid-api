# Guide for AI Agents - MCP Vector Search & Skills

## 1. MCP Vector Search

### IMPORTANT: Always Use the MCP Search

This project has a semantic search system called **MCP Vector Search** configured.

#### ✅ ALWAYS use MCP tools instead of shell commands

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

#### Examples of Correct Usage

##### ❌ BAD (using shell commands)

```
Looking for the authentication file...
> grep -r "validateLogin" apps/back/src
> cat apps/back/src/modules/iam/auth/auth.service.ts
```

##### ✅ GOOD (using MCP)

```
Looking for the authentication file...
> buscar_codigo(query="login validation logic")
```

#### Recommended Workflow

1. **Before any code search**: Use `buscar_codigo` with a natural language description
2. **If you need to know if the index is up to date**: Use `stats_index` or `necesita_reindex`
3. **Only after getting results from MCP**: If you need to see the full file, then read it

#### Important Notes

- The index already contains all the code in the project
- Searches are semantic: you can describe what you're looking for instead of knowing the exact name
- It's faster and more accurate than using shell commands

#### Need to Re-index?

If the code has changed and results don't seem correct, ask the user if they want to re-index by running:

```
npx tsx mcp-engine/src/cli.ts index --force
```

---

## 2. Skills System

OpenCode skills provide specialized workflows and domain knowledge. Use the `skill` tool to load them when relevant.

### Available Skills

| Skill                        | Purpose                          | When to Load                  |
| ---------------------------- | -------------------------------- | ----------------------------- |
| `skill-creator`              | Create new OpenCode skills       | When asked to build a skill   |
| `backend-resource-generator` | NestJS CRUD, migrations, seeders | For backend development tasks |
| `vue-form-generator`         | Vue forms with Zod validation    | For creating forms            |
| `vue-data-table`             | Paginated tables with TanStack   | For displaying tabular data   |

### How Skills Work

1. **Discovery**: The agent sees skill `name` and `description` in `<available_skills>`
2. **Loading**: Call `skill({ name: "skill-name" })` to load full content
3. **Usage**: Follow the skill's instructions for the specific workflow

### Skill Discovery Pattern

Skills trigger when user queries match their description. Examples:

| User Query                  | Skill to Load                |
| --------------------------- | ---------------------------- |
| "Create a Product resource" | `backend-resource-generator` |
| "Add a email field to User" | `backend-resource-generator` |
| "Build a user form"         | `vue-form-generator`         |
| "Create a users table"      | `vue-data-table`             |
| "How do I make a skill?"    | `skill-creator`              |

### Cross-Skill References

Skills reference each other and documentation:

```markdown
## See Also

- `vue-data-table` - For displaying tabular data
- `docs/ARCHITECTURE.md` - For project structure context
```

### Skill vs Documentation

| Use Case                                   | Use                                       |
| ------------------------------------------ | ----------------------------------------- |
| Step-by-step workflow with commands        | **Skills**                                |
| Architectural overview or design decisions | **docs/\*.md**                            |
| API schemas, schemas, reference material   | **docs/** or **references/** inside skill |
| Explaining code patterns                   | **MCP Vector Search** + code reading      |

### Loading Multiple Skills

If a task spans multiple domains, load relevant skills:

```
User: "Create a Product CRUD with a form to manage it"
→ Load: backend-resource-generator + vue-form-generator
```

### Skills Location

Project skills are in `.opencode/skills/`. The agent automatically discovers skills when working in this project.

---

## 3. Documentation Reference

Project documentation is in `docs/`:

| Document                       | Content                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`         | Monorepo structure, tech stack overview                                    |
| `docs/BACKEND-RESOURCES.md`    | Backend development guide (complements `backend-resource-generator` skill) |
| `docs/GENERATORS.md`           | Hygen CLI reference                                                        |
| `docs/FRONTEND-LAYERS.md`      | Nuxt 3 layers guide (complements frontend skills)                          |
| `docs/EXTENSIONS-SYSTEM.md`    | Backend modular architecture                                               |
| `docs/AUTHORIZATION.md`        | Auth decorators, guards, RBAC                                              |
| `docs/EMAIL-SYSTEM.md`         | Mail service and templates                                                 |
| `docs/STORAGE-ARCHITECTURE.md` | File storage (local/S3)                                                    |
| `docs/WEBHOOKS.md`             | Webhook handling                                                           |
| `docs/TRANSLATIONS.md`         | i18n system                                                                |
| `docs/API-KEYS.md`             | API key authentication                                                     |
| `docs/ERROR-LOGGING.md`        | Error tracking                                                             |
| `docs/MCP-VECTOR-SEARCH.md`    | Semantic search system                                                     |

### When to Reference Docs

Use docs for **context and theory**, skills for **action**:

| Task                                   | Approach                               |
| -------------------------------------- | -------------------------------------- |
| "I need to understand the auth system" | Read `docs/AUTHORIZATION.md`           |
| "Create a new backend resource"        | Use `backend-resource-generator` skill |
| "Build a settings form"                | Use `vue-form-generator` skill         |
| "How does the extension system work?"  | Read `docs/EXTENSIONS-SYSTEM.md`       |

---

## 4. Quick Reference

### Starting a Backend Task

```
1. Load: skill({ name: "backend-resource-generator" })
2. Follow workflow for resources/migrations/seeds
3. Reference docs/ARCHITECTURE.md for structure context
```

### Starting a Frontend Task

```
1. Identify: Form (vue-form-generator) or Table (vue-data-table)?
2. Load relevant skill
3. Reference docs/FRONTEND-LAYERS.md if needed
```

### Creating a New Skill

```
1. Load: skill({ name: "skill-creator" })
2. Follow the 6-step creation process
3. Use scaffold script in .opencode/skills/skill-creator/scripts/
```
