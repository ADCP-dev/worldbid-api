# Skill Registry — Foundation

**Project**: foundation
**Generated**: 2026-04-20
**Mode**: engram (no openspec/)

## Skills

> Priority: Project-level skills override user-level skills with the same name.

### Project-Level Skills (foundation)

| Skill | Description | Path |
|-------|-------------|------|
| `apify-scrape` | Deep-scrape documentation sites | `.agents/skills/apify-scrape/SKILL.md` |
| `github-cli` | GitHub PR, issues, workflows management | `.agents/skills/github-cli/SKILL.md` |
| `graph-query` | Knowledge graph building + querying | `.agents/skills/graph/SKILL.md` |
| `tavily-cli` | Web search, content extraction, crawling | `.agents/skills/tavily-cli/SKILL.md` |
| `vue-data-table` | TanStack Vue Table + backend integration | `.agents/skills/frontend/references/tables.md` |
| `vue-form-generator` | Vue forms with Zod validation | `.agents/skills/frontend/references/forms.md` |

### User-Level Skills (opencode)

| Skill | Description | Path |
|-------|-------------|------|
| `branch-pr` | PR creation workflow (issue-first) | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| `go-testing` | Go testing patterns (Gentleman.Dots) | `~/.config/opencode/skills/go-testing/SKILL.md` |
| `issue-creation` | Issue creation workflow (issue-first) | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| `judgment-day` | Parallel adversarial review | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| `skill-creator` | Create new AI agent skills | `~/.config/opencode/skills/skill-creator/SKILL.md` |

### SDD Skills

| Skill | Purpose | Path |
|-------|---------|------|
| `sdd-apply` | Implement tasks from change | `~/.config/opencode/skills/sdd-apply/SKILL.md` |
| `sdd-archive` | Sync specs and archive change | `~/.config/opencode/skills/sdd-archive/SKILL.md` |
| `sdd-design` | Technical design document | `~/.config/opencode/skills/sdd-design/SKILL.md` |
| `sdd-explore` | Explore and investigate ideas | `~/.config/opencode/skills/sdd-explore/SKILL.md` |
| `sdd-init` | Initialize SDD context | `~/.config/opencode/skills/sdd-init/SKILL.md` |
| `sdd-onboard` | End-to-end SDD walkthrough | `~/.config/opencode/skills/sdd-onboard/SKILL.md` |
| `sdd-propose` | Create change proposal | `~/.config/opencode/skills/sdd-propose/SKILL.md` |
| `sdd-spec` | Write specifications | `~/.config/opencode/skills/sdd-spec/SKILL.md` |
| `sdd-tasks` | Break down into tasks | `~/.config/opencode/skills/sdd-tasks/SKILL.md` |
| `sdd-verify` | Validate implementation vs specs | `~/.config/opencode/skills/sdd-verify/SKILL.md` |

## Project Conventions

**Agent Guide**: `AGENTS.md` (project root) — Source of truth for agent behavior.

### Key Conventions

- **No AI attribution in commits** — Conventional commits only
- **No build after changes** — Unless explicitly requested
- **MCP > Shell** — Always use vectorize_*, context7_*, pencil_*, engram_mem_* tools
- **Path aliases** — Always use `@iam/*`, `@users/*`, `@infra/*`, `@/` (front) over relatives
- **import type** — For types-only imports
- **Never `any`** — Use `unknown` + guards
- **NestJS Logger** — No console.log/console.error
- **Tests** — Must use `it("should ...")` format
- **Scope** — Changes scoped to the task only

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

1. `mem_search(query: "skill-registry", project: "foundation")` → get registry
2. Cache: `skill-name → resolved-path`
3. Include in sub-agent prompt: `SKILL: Load \`{resolved-path}\` before starting.`

## Scan Sources

- **User skills**: `~/.config/opencode/skills/*/SKILL.md`
- **Project skills**: `.agents/skills/*/SKILL.md`
- **Conventions**: `AGENTS.md` (index), `.cursorrules`, `CLAUDE.md`