---
name: skill-creator
description: |-
  Create OpenCode skills to extend agent capabilities with specialized workflows.
  Use when: building new project/global skills, scaffolding skill structure, validating existing skills.

  Examples:
  - user: "Create a skill for API documentation" → scaffold skill with proper structure
  - user: "Build a skill to handle our deployment flow" → create skill with scripts/references
  - user: "How do I make a skill?" → guide through 6-step creation process
  - user: "Validate my skill is correct" → run validation checks
  - user: "I need a skill for code review" → scaffold and customize skill
---

# Skill Creator

Create OpenCode skills that provide specialized workflows, tool integrations, domain expertise, and bundled resources.

## Overview

Skills are **SOPs/workflows** (NOT agents). They contain:

- **Frontmatter** - Metadata for discovery (name, description)
- **Instructions** - Core workflow in markdown body
- **Bundled resources** - Optional scripts/, references/, assets/

## When to Create a Skill

Create a skill when you repeatedly:

- Follow the same multi-step process
- Re-discover the same schemas/docs
- Rewrite the same code patterns
- Use the same templates

## The 6-Step Creation Process

### Step 1: Understand

Gather concrete usage examples before writing anything:

Ask yourself (or the user):

- What should this skill do?
- What requests should trigger it?
- Give 3-5 example user queries and expected actions

**Do not proceed until you have clear examples.**

### Step 2: Plan

Identify which resources the skill needs:

| If you find yourself...     | Add to...     |
| --------------------------- | ------------- |
| Rewriting same code         | `scripts/`    |
| Re-discovering schemas/docs | `references/` |
| Copying same templates      | `assets/`     |

Example planning output:

```
Skill: api-doc-generator
├── SKILL.md (workflow + invocation pattern)
├── scripts/
│   └── generate-docs.py (OpenAPI → markdown)
└── references/
    └── openapi-schema.md (schema reference)
```

### Step 3: Initialize

Create the skill directory structure:

**Project skill** (repo-specific):

```bash
mkdir -p .opencode/skills/<skill-name>
mkdir -p .opencode/skills/<skill-name>/{scripts,references,assets}
```

**Global skill** (personal, all projects):

```bash
mkdir -p ~/.config/opencode/skills/<skill-name>
mkdir -p ~/.config/opencode/skills/<skill-name>/{scripts,references,assets}
```

Or use the scaffold script:

```bash
cd .opencode/skills
../../skill-creator/scripts/new-skill.sh <skill-name> [--project | --global]
```

### Step 4: Edit

Create `SKILL.md` with proper frontmatter:

```yaml
---
name: skill-name
description: |-
  [Action verb/capabilities]. Use for [specific cases]. Use proactively when [contexts].

  Examples:
  - user: "query" → action
  - user: "query" → action
---
```

**Critical formatting rules:**

1. **Use `|-` literal block scalar** for multi-line descriptions (NOT plain YAML with lists)
2. **Start with action verb** (NOT "You are" or "[Role] expert")
3. **Name must match directory** exactly (lowercase-hyphen, 1-64 chars)
4. **Description 1-1024 chars** - dense, LLM-parseable

**Name validation regex:**

```
^[a-z0-9]+(-[a-z0-9]+)*$
```

Valid: `my-skill`, `api-v2`, `typescript-advanced`
Invalid: `MySkill`, `my_skill`, `-my-skill`, `my--skill`

### Step 5: Validate

Manual checks (see `references/validation-guide.md`):

- [ ] `SKILL.md` exists in skill directory
- [ ] Directory name matches `name:` in frontmatter exactly
- [ ] YAML frontmatter parses correctly
- [ ] `name:` is 1-64 lowercase-hyphen chars
- [ ] `description:` exists and is 1-1024 chars
- [ ] Description starts with action verb (not "You are")
- [ ] 3-5 concrete examples in description
- [ ] Optional directories created only if needed

### Step 6: Iterate

After real usage:

- Does the skill trigger on relevant queries?
- Is the guidance clear enough?
- Update description to include missing trigger contexts
- Add examples for edge cases

## Frontmatter Reference

| Field           | Required | Description                                                  |
| --------------- | -------- | ------------------------------------------------------------ |
| `name`          | Yes      | Hyphen-case identifier, 1-64 chars, matches directory        |
| `description`   | Yes      | Self-contained summary with capabilities, triggers, examples |
| `license`       | No       | MIT, Apache-2.0, etc.                                        |
| `compatibility` | No       | Target platform (e.g., "opencode")                           |
| `metadata`      | No       | Map of string→string for additional info                     |

**Unknown fields are ignored.**

## Directory Structure

```
skill-name/
├── SKILL.md              # Required - frontmatter + instructions
├── scripts/              # Optional - executable code (Python/Bash)
├── references/           # Optional - docs loaded on-demand
└── assets/               # Optional - templates, images, fonts
```

**MUST NOT include:** README.md, CHANGELOG.md, INSTALLATION_GUIDE.md

## Skill Types

### Project Skills

- Location: `.opencode/skills/<name>/SKILL.md`
- Scope: Team-shared, repo-specific
- Examples: `our-api-patterns`, `project-deploy`, `db-migrations`

### Global Skills

- Location: `~/.config/opencode/skills/<name>/SKILL.md`
- Scope: Personal tools for all projects
- Examples: `pdf-editor`, `commit-helper`, `code-formatter`

## Common Mistakes

### YAML Parsing Errors

```yaml
# ❌ WRONG - breaks YAML (unquoted colons, list without |-)
description: Handle plugins. Examples:
- user: "..." → action

# ✅ CORRECT - use |- literal block scalar
description: |-
  Handle plugins.

  Examples:
  - user: "..." → action
```

### Name Mismatches

```yaml
# ❌ WRONG - name doesn't match directory "my-skill"
name: mySkill

# ✅ CORRECT
name: my-skill  # directory: .opencode/skills/my-skill/
```

### Vague Descriptions

```yaml
# ❌ WRONG - vague, no actionable info
description: This skill helps with coding.

# ✅ CORRECT - specific capabilities + triggers + examples
description: |-
  Handle TypeScript type errors and strict mode compliance. Use proactively when
  users mention "type error", "TypeScript strict", or "cannot assign type".

  Examples:
  - user: "Fix this type error" → diagnose and fix type mismatch
  - user: "Enable strict mode" → configure tsconfig strict settings
```

## Workflow Orchestration

For complex skills, structure instructions by freedom level:

| Freedom | Format             | Use When                          |
| ------- | ------------------ | --------------------------------- |
| High    | Text instructions  | Multiple valid approaches         |
| Medium  | Pseudocode/scripts | Preferred pattern exists          |
| Low     | Specific scripts   | Fragile ops, consistency critical |

**Progressive disclosure:** Keep core workflow in SKILL.md. Move variant-specific details to `references/` subdirectories.

Example:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

## Bundled Resources

### scripts/

Reusable executable code (Python/Bash). Use when:

- Same code rewritten repeatedly
- Complex logic that shouldn't be in markdown

Make executable: `chmod +x scripts/*.sh`

### references/

Documentation loaded on-demand. Use for:

- API schemas
- Configuration formats
- Detailed explanations

Agent loads via Read tool when needed.

### assets/

Templates, images, fonts. Use for:

- File templates used in output
- Not loaded into context - agent reads on demand

## Quick Reference

**Discovery path for project skills:**
OpenCode walks up from cwd to git worktree root, loading `.opencode/skills/*/SKILL.md`.

**Skill appears in agent output:**

```xml
<available_skills>
  <skill>
    <name>skill-name</name>
    <description>...</description>
  </skill>
</available_skills>
```

**Agent loads skill via:**

```javascript
skill({ name: "skill-name" });
```

## See Also

- `references/frontmatter-guide.md` - Detailed frontmatter syntax
- `references/skill-structure.md` - Directory structure details
- `references/validation-guide.md` - Validation checklist
- `scripts/new-skill.sh` - Scaffold new skills automatically
- `docs/ARCHITECTURE.md` - Project structure context (for project-specific skills)
