# Foundation — Tool Catalog

> **Read this before starting any task. Do NOT guess what tools exist.**

This document catalogs every tool, script, command, and service available in the Foundation project. It is the single source of truth for knowing _what_ exists before deciding _how_ to build something.

---

## 1. Code Generation

All Hygen generators run from `apps/back/`. Templates live in `apps/back/.hygen/`.

| Command | Description | Output Location |
|---------|-------------|-----------------|
| `pnpm generate:resource` | Scaffolds full CRUD module (domain, dto, entity, repository, controller, service) with class-transformer decorators. Prompts for resource name and destination (`custom/` or `modules/`). | `src/<destination>/<name>/` |
| `pnpm generate:extension` | Same as `generate:resource` but outputs into an extension folder. Module file named `extension.module.ts`. No manual imports needed — auto-discovered. | `src/extensions/<name>/` |
| `pnpm add:property` | Adds a new column to an existing resource. Prompts for property name, kind (`primitive` / `reference`), type, nullable. Updates entity, domain object, and DTOs. | In-place |
| `pnpm add:extension-property` | Same as `add:property` but targets an extension resource. | In-place |
| `pnpm seed:create` | Creates an empty seed file in `src/infrastructure/database/seeds/`. | `src/infrastructure/database/seeds/` |

### Hygen Template Anatomy

Each `.ejs.t` file has a YAML front-matter header (`to:` path) and an EJS body. Custom generators can be added under `apps/back/.hygen/<my-generator>/`.

---

## 2. Database

All commands run from `apps/back/`.

| Command | Description |
|---------|-------------|
| `pnpm migration:generate <name>` | Generates a TypeORM migration file by comparing entities against the live database. Always review the output before running. |
| `pnpm migration:run` | Executes all pending migrations. |
| `pnpm migration:revert` | Rolls back the last migration. |
| `pnpm seed:run` | Runs all seeders in order. Seeds use `upsert` with fixed UUIDs — safe to run multiple times. |
| `pnpm i18n:add` | Interactive CLI to scaffold new translation keys. Prompts for app context, section, key, and content per language. |

### Table Conventions

| Convention | Rule |
|------------|------|
| Extension tables | Prefixed with `ext_<name>_` to avoid collisions with core tables |
| Migration naming | PascalCase descriptive name (e.g., `AddProductPriceColumn`) |
| Migrations location | `src/infrastructure/database/migrations/` |

---

## 3. Development

All commands run from the repository root unless noted.

| Command | Description |
|---------|-------------|
| `pnpm dev` | Starts both backend and frontend in parallel via Turborepo. |
| `pnpm dev --filter back` | Starts only the NestJS backend. |
| `pnpm dev --filter front` | Starts only the Nuxt frontend. |
| `pnpm build` | Builds all apps via Turborepo. |
| `pnpm lint` | Runs ESLint across all workspaces. |
| `pnpm check-types` | Runs TypeScript type-checking across all workspaces. |
| `pnpm format` | Runs Prettier on all `*.{ts,tsx,md}` files. |

### Turborepo Filters

Use `--filter <workspace>` to scope commands to a specific workspace:

- `--filter back` — apps/back
- `--filter front` — apps/front
- `--filter mcp-engine` — mcp-engine

---

## 4. Documentation

| Command | Description |
|---------|-------------|
| `pnpm docs:sync` | Scans `docs/modules/`, `docs/extensions/`, `docs/custom/`, `docs/research/` for `.md` files with YAML frontmatter, validates integrity (required fields, no duplicate IDs, valid parent/dependency references), and regenerates `docs/ARCHITECTURE.md` with tables and a Mermaid dependency diagram. |
| `pnpm obsidian:sync` | Runs `bin/sync-obsidian.js` which syncs Obsidian vault content into the Graphify knowledge graph. Fetches markdown from the vault, runs `graphify` on it, and merges the result with the project's main graph. |

### Module Documentation Format

All module docs in `docs/modules/` use YAML frontmatter between `---` markers:

```yaml
---
id: "unique-id"
name: "Human Readable Name"
type: "module"        # module | extension | custom | research
parent: null           # parent ID (null for top-level)
dependencies: []       # array of dependency IDs
conventions: []        # array of project conventions
entities: []           # array of entity names (optional)
aliases: []            # array of path alias mappings (optional)
external_apis: []      # array of external API names (optional)
---
```

---

## 5. Knowledge Graph

Graphify builds a knowledge graph from markdown documentation, enabling semantic exploration and MCP-based querying.

| Command | Description |
|---------|-------------|
| `graphify ./docs --out graphify-out` | Generates knowledge graph from all docs. Produces `graph.json`, `GRAPH_REPORT.md`, and `graph.html`. |
| `graphify opencode install` | Installs the Graphify OpenCode plugin for automatic graph updates on file changes. |
| `graphify hook install` | Installs a git pre-commit hook that updates the graph on every commit. |
| `graphify merge-graphs <a.json> <b.json> --out merged.json` | Merges two graph files (used by `obsidian:sync`). |
| `python -m graphify.serve graphify-out/graph.json` | Starts the MCP server for knowledge graph queries via LLM tools. |

### Configuration Files

| File | Purpose |
|------|---------|
| `.graphifyignore` | Exclusions for graph generation (node_modules, dist, etc.) |
| `.opencode/plugins/graphify.js` | OpenCode plugin for auto-sync |

---

## 6. Worktrees

Git worktrees allow multiple independent working copies of the same repository, each on its own branch.

| Command | Description |
|---------|-------------|
| `pnpm worktree:spawn <issue-number>` | Creates a new worktree from a GitHub Issue. Reads issue body for branch name, creates `feature/issue-<N>`, and sets up the worktree at `../worktrees/task-<N>/`. |
| `pnpm worktree:cleanup <name>` | Removes a worktree and its local branch. Cleans up with `git worktree remove --force`. |

### Worktree Conventions

| Rule | Details |
|------|---------|
| Location | Worktrees are created OUTSIDE the repo at `../worktrees/` to avoid interfering with `pnpm-workspace.yaml`. |
| Autonomy | Each worktree has its own `node_modules`, `.env`, and full git history. |
| Isolation | Different agents can work in parallel on different worktrees without interference. |

---

## 7. Skills

All skills are listed in the project's skill registry. Grouped by loading strategy:

### Always-Loaded (auto-detect)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `backend-resource-generator` | Creating CRUD, migrations, seeds | Generate NestJS backend resources and manage database schema |
| `vue-form-generator` | Creating/editing forms | Vue forms with Zod validation using base UI components |
| `vue-data-table` | Tabular data display | Paginated data tables with TanStack Vue Table |
| `nuxt` | Working on Nuxt features | Nuxt 4+ patterns: server routes, h3 helpers, file-based routing |
| `frontend-design` | Building UI components/pages | Production-grade frontend with Tailwind/DaisyUI |
| `backend-development` | General backend work | NestJS backend development workflows |
| `typeorm` | Database/ORM work | TypeORM patterns and best practices |
| `daisyui` | Using DaisyUI components | Tailwind CSS component library with themes |
| `nestjs-best-practices` | Reviewing/refactoring | NestJS production-ready patterns |
| `GitHub CLI` | GitHub operations | PRs, issues, workflows, releases via `gh` |
| `tavily-cli` | Web search, research | Official Tavily CLI — real-time web search for LLMs |
| `apify-scrape` | Web scraping, data extraction | Run Apify actors to scrape websites into structured Markdown |

### On-Demand (load manually)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `skill-creator` | Creating new AI skills | Follows Agent Skills spec to create project skills |
| `go-testing` | Writing Go tests | Bubbletea TUI testing patterns |
| `find-skills` | Looking for capabilities | Discover and install available skills |
| `playwright-cli` | Browser automation | Testing, screenshots, scraping |

### SDD Phases

| Skill | Purpose |
|-------|---------|
| `sdd-explore` | Investigate ideas before committing |
| `sdd-propose` | Create change proposal |
| `sdd-spec` | Write specifications |
| `sdd-design` | Create technical design |
| `sdd-tasks` | Break down into implementation tasks |
| `sdd-apply` | Implement tasks from specs |
| `sdd-verify` | Validate implementation |
| `sdd-archive` | Archive completed change |
| `sdd-init` | Initialize SDD in a project |
| `sdd-onboard` | Walk through full SDD cycle |

---

## 8. External Research

### Tavily CLI (`tavily-cli`)

Official Tavily search CLI for real-time web search. Integrated as a project skill.

**Skill file:** `.opencode/skills/tavily-cli/SKILL.md`
**API Key:** `TAVILY_API_KEY` in `.env.local`

**API Endpoint:** `POST https://api.tavily.com/search`
**Auth:** `Authorization: Bearer <TAVILY_API_KEY>`

| Parameter | Values | Default | Notes |
|-----------|--------|---------|-------|
| `query` | string | — | **Required.** Search query. |
| `search_depth` | `basic` (1 credit), `advanced` (2 credits), `fast`, `ultra-fast` | `basic` | Use `advanced` for technical queries |
| `topic` | `general`, `news`, `finance` | `general` | |
| `max_results` | 0-20 | 5 | |
| `include_answer` | `true`, `false`, `"basic"`, `"advanced"` | `false` | LLM-generated summary |
| `time_range` | `day`, `week`, `month`, `year` | — | Filter by publish date |
| `include_domains` | `["docs.stripe.com"]` | `[]` | Restrict to specific domains |
| `exclude_domains` | `["reddit.com"]` | `[]` | Exclude noise domains |

**Rules:**
- Max 3 queries per task (API credits cost)
- Save findings to `docs/research/<issue>--<topic>.md` with YAML frontmatter
- Check Context7 first for library-specific docs (free)

### Apify Scrape (`apify-scrape`)

Run Apify Actors to scrape structured data from websites. Output saved to `docs/research/` for ingestion into the knowledge graph.

**Skill file:** `.opencode/skills/apify-scrape/SKILL.md`
**API Key:** `APIFY_API_KEY` in `.env.local`

**API Endpoint:** `POST https://api.apify.com/v2/acts/{actorId}/runs`
**Auth:** `Authorization: Bearer <APIFY_API_KEY>`

| Actor | Purpose |
|-------|---------|
| `apify/website-content-crawler` | Scrape documentation sites, outputs Markdown + HTML |
| `apify/web-scraper` | Generic web scraping with Cheerio/Playwright |

**Workflow (async):**
1. `POST /v2/acts/{actorId}/runs` — start actor run, get `runId` + `defaultDatasetId`
2. `GET /v2/acts/{actorId}/runs/{runId}` — poll every 5s until `SUCCEEDED`
3. `GET /v2/datasets/{defaultDatasetId}/items` — fetch structured results

**Workflow (sync, ≤300s):**
`POST /v2/acts/{actorId}/run-sync` — returns dataset items directly

**Rules:**
- Only use if Tavily is insufficient (Apify costs per compute unit)
- Max 20 pages per scrape
- Save output to `docs/research/<source-name>/<slug>.md`
- After scraping, run `graphify ./docs --update` to integrate into the graph
- Respect robots.txt

### Context7 (`context7_*`)

Documentation resolver with code examples. Already available as MCP tools.

| Tool | Description |
|------|-------------|
| `context7_resolve-library-id` | Resolve a package name to a valid Context7 library ID |
| `context7_query-docs` | Query documentation with code examples. Use `researchMode: true` for deep investigation |

### Decision Guide

| Need | Tool | Cost |
|------|------|------|
| "How do I use `useFetch` in Nuxt 4?" | **Context7** | Free |
| "Breaking changes in Stripe API 2026?" | **Tavily** | API credits |
| "Full reference of OpenAI Assistants API" | **Apify** | Compute units |
| "Find docs + code examples for framework W" | Context7 → Tavily fallback | |

---

## 9. Memory & Code Search

### Engram (`engram_mem_*`)

Persistent memory system that survives across sessions and compactions.

| Tool | Description |
|------|-------------|
| `engram_mem_save` | Save an observation to persistent memory. Call after: architecture decisions, bug fixes, discoveries, patterns, config changes. |
| `engram_mem_search` | Search past observations by keywords or natural language. |
| `engram_mem_context` | Get recent memory context from previous sessions. |
| `engram_mem_get_observation` | Get full content of a past observation by ID. |
| `engram_mem_update` | Update an existing observation by ID. |
| `engram_mem_suggest_topic_key` | Get a stable topic key for evolving topics. |
| `engram_mem_session_summary` | Save end-of-session summary. |
| `engram_mem_session_start` | Register the start of a new session. |
| `engram_mem_session_end` | Mark a session as completed. |
| `engram_mem_capture_passive` | Extract structured learnings from text output. |
| `engram_mem_save_prompt` | Save user prompt to memory for context continuity. |

### Vector Search (`vectorize_*`)

Semantic code search (hybrid vector + BM25) for the entire codebase.

| Tool | Description |
|------|-------------|
| `vectorize_buscar_codigo` | Search code by meaning/semantics (preferred over grep). |
| `vectorize_stats_index` | View index statistics. |
| `vectorize_necesita_reindex` | Check if the vector index is up to date. |

### MCP Engine

Located at `mcp-engine/`. A semantic search engine using Qdrant for vector storage.

| Command | Description |
|---------|-------------|
| `pnpm mcp` | Start the MCP server from `mcp-engine/src/cli.ts`. |

---

## 10. Extension CLI

Commands for managing backend extensions (auto-discovered modules).

| Command | Description |
|---------|-------------|
| `add-extension` | Scaffolds a new extension. Creates folder structure under `src/extensions/<name>/` with `extension.module.ts` and full CRUD. |
| `remove-extension` | Removes an extension directory. `rm -rf src/extensions/<name>` — since extensions are auto-discovered, no other files need editing. |
| `build-extension` | Builds an extension for distribution. Compiles and packages the extension so it can be copied to another project. |

### Extension Structure

```
src/extensions/<name>/
├── extension.module.ts          ← Required: auto-discovered by ExtensionLoaderModule
├── extension.config.ts          ← Optional: registerAs config
├── <name>.controller.ts
├── <name>.service.ts
├── domain/
│   └── <name>.ts
├── dto/
├── infrastructure/
│   └── persistence/
│       ├── <name>.repository.ts
│       └── relational/
│           ├── entities/
│           ├── repositories/
│           ├── mappers/
│           └── relational-persistence.module.ts
└── seeds/                        ← Optional: auto-discovered by ExtensionSeedLoaderModule
    ├── <name>-seed.module.ts
    └── <name>-seed.service.ts
```

### Key Rules

| Convention | Rule |
|------------|------|
| Zero manual wiring | Drop a folder → works. Delete a folder → gone. No `app.module.ts` edits. |
| Module file name | Must be `extension.module.ts` |
| Table prefix | `ext_<name>_` to avoid collisions |
| Entity discovery | Automatic via TypeORM glob `**/*.entity{.ts,.js}` |
| Config | `extension.config.ts` with `registerAs` for env variables |
