# Skill Registry — Foundation

**Project**: foundation
**Generated**: 2026-05-20
**Mode**: engram (no openspec/)

## Skills

> Priority: Project-level skills override user-level skills with the same name.

### Project-Level Skills (foundation)

| Skill | Description | Path |
|-------|-------------|------|
| `apify-scrape` | Run Apify Actors to deep-scrape documentation sites | `.agents/skills/apify-scrape/SKILL.md` |
| `backend` | NestJS + TypeORM + Hygen generators for CRUD, migrations, seeds | `.agents/skills/backend/SKILL.md` |
| `frontend` | Nuxt 4 + Vue 3 + Tailwind + DaisyUI + TanStack for forms, tables, pages | `.agents/skills/frontend/SKILL.md` |
| `github-cli` | GitHub CLI operations: PRs, issues, workflows, releases | `.agents/skills/github-cli/SKILL.md` |
| `graph` | Query Foundation knowledge graph (graphify-out/graph.json) | `.agents/skills/graph/SKILL.md` |
| `tavily-cli` | Web search, content extraction, crawling, deep research | `.agents/skills/tavily-cli/SKILL.md` |

### User-Level Skills (opencode)

| Skill | Description | Path |
|-------|-------------|------|
| `branch-pr` | PR creation workflow (issue-first enforcement) | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| `find-skills` | Discover and install agent skills | `~/.agents/skills/find-skills/SKILL.md` |
| `go-testing` | Go testing patterns with Bubbletea TUI support | `~/.config/opencode/skills/go-testing/SKILL.md` |
| `graphify` | Code/docs → knowledge graph → HTML + JSON + audit | `~/.config/opencode/skills/graphify/SKILL.md` |
| `issue-creation` | Issue creation workflow (issue-first enforcement) | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| `judgment-day` | Parallel adversarial review protocol (dual blind judges) | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| `skill-creator` | Create new AI agent skills (Agent Skills spec) | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| `skill-registry` | Create/update project skill registry | `~/.config/opencode/skills/skill-registry/SKILL.md` |

### SDD Skills

| Skill | Purpose | Path |
|-------|---------|------|
| `sdd-apply` | Implement tasks from change | `~/.config/opencode/skills/sdd-apply/SKILL.md` |
| `sdd-archive` | Sync delta specs and archive completed change | `~/.config/opencode/skills/sdd-archive/SKILL.md` |
| `sdd-design` | Create technical design document | `~/.config/opencode/skills/sdd-design/SKILL.md` |
| `sdd-explore` | Investigate ideas before committing | `~/.config/opencode/skills/sdd-explore/SKILL.md` |
| `sdd-init` | Initialize SDD context in project | `~/.config/opencode/skills/sdd-init/SKILL.md` |
| `sdd-onboard` | End-to-end SDD walkthrough | `~/.config/opencode/skills/sdd-onboard/SKILL.md` |
| `sdd-propose` | Create change proposal | `~/.config/opencode/skills/sdd-propose/SKILL.md` |
| `sdd-spec` | Write specifications with requirements + scenarios | `~/.config/opencode/skills/sdd-spec/SKILL.md` |
| `sdd-tasks` | Break down change into task checklist | `~/.config/opencode/skills/sdd-tasks/SKILL.md` |
| `sdd-verify` | Validate implementation against specs | `~/.config/opencode/skills/sdd-verify/SKILL.md` |

## Project Conventions

**Agent Guide**: `AGENTS.md` (project root) — Source of truth for agent behavior.

### Referenced Docs (from AGENTS.md)

| Document | Content |
|----------|---------|
| `docs/ARCHITECTURE.md` | Auto-generated module registry + Mermaid dependency diagram |
| `docs/TOOLS.md` | Complete tool catalog: generators, database, dev, docs, graph, worktrees, skills, research, memory |
| `docs/FRONTEND-LAYERS.md` | Nuxt layers, middleware, auth store patterns |
| `docs/EXTENSIONS-SYSTEM.md` | Dynamic extension module system (copy-paste auto-discovery) |
| `docs/GENERATORS.md` | Hygen CLI generators reference |
| `docs/TYPESCRIPT-GUIDELINES.md` | TypeScript conventions: imports, types, null handling, logging |
| `docs/modules/auth.md` | Authentication & Authorization (RBAC, guards, decorators) |
| `docs/modules/database.md` | Database & Migrations |
| `docs/modules/email.md` | Email System (Nodemailer + Maizzle + queues) |
| `docs/modules/error-logging.md` | Error Tracking |
| `docs/modules/storage.md` | File Storage (S3/local/presigned drivers) |
| `docs/modules/translations.md` | i18n Translations (nestjs-i18n, JSON files) |
| `docs/modules/webhooks.md` | Webhooks |
| `docs/extensions/cms.md` | CMS extension |
| `docs/extensions/cms-audit.md` | CMS Audit & Gap Analysis |

### Key Conventions

- **No AI attribution in commits** — Conventional commits only (`feat:`, `fix:`, `docs:`, etc.)
- **No build after changes** — Unless explicitly requested
- **Path aliases always** — `@iam/*`, `@users/*`, `@infra/*` (back); `@`, `@base/*`, `@cms/*` (front)
- **`import type`** for types-only imports
- **Never `any`** — Use `unknown` + type guards
- **NestJS Logger** only — No `console.log` / `console.error`
- **Tests format** — `it("should ...")` required by ESLint
- **Scope discipline** — Changes limited to the task's files
- **Extension tables** — Prefixed `ext_<name>_` to avoid collisions
- **Migrations** — Via TypeORM CLI only (`pnpm migration:generate` + `pnpm migration:run`)
- **Generators > Manual code** — Backend CRUD via Hygen; Frontend forms/tables via base components

### Path Aliases (Backend)

| Alias | Destino |
|-------|---------|
| `@iam/*` | `src/modules/iam/*` |
| `@users/*` | `src/modules/users/*` |
| `@comms/*` | `src/modules/communications/*` |
| `@billing/*` | `src/modules/billing/*` |
| `@storage/*` | `src/modules/storage/*` |
| `@social/*` | `src/modules/social/*` |
| `@infra/*` | `src/infrastructure/*` |
| `@src/*` | `src/*` |
| `@core/*` | `src/core/*` |
| `@ext/*` | `src/extensions/*` |

### Path Aliases (Frontend)

| Alias | Destino |
|-------|---------|
| `@` | `apps/front/` |
| `@base/*` | `apps/front/modules/base/*` |
| `@cms/*` | `apps/front/modules/cms/*` |
| `@landing/*` | `apps/front/modules/landing/*` |

## Skill Resolution (Orchestrator)

When launching sub-agents, resolve skill paths once per session:

1. `engram_mem_search(query: "skill-registry", project: "foundation")` → get registry
2. Cache: `skill-name → resolved-path`
3. Include in sub-agent prompt: `SKILL: Load \`{resolved-path}\` before starting.`

## Scan Sources

- **User skills**: `~/.config/opencode/skills/*/SKILL.md`, `~/.agents/skills/*/SKILL.md`
- **Project skills**: `.agents/skills/*/SKILL.md`
- **Conventions**: `AGENTS.md` (index), docs/ referenced from AGENTS.md
