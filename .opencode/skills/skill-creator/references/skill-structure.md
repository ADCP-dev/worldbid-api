# Skill Structure Guide

Directory structure and file organization for OpenCode skills.

## Required Structure

```
skill-name/
└── SKILL.md              # Required
```

## Optional Directories

```
skill-name/
├── SKILL.md
├── scripts/               # Optional - executable code
├── references/            # Optional - documentation
└── assets/               # Optional - templates, images
```

Create only directories you will actually use.

## SKILL.md

**Required.** Contains YAML frontmatter + markdown body.

### Frontmatter

YAML metadata block at top of file:

```yaml
---
name: skill-name
description: |-
  [Self-contained description]
---
```

### Body

Markdown content with:

- Core workflow/instructions
- When to use the skill
- Examples
- Troubleshooting

## scripts/

Reusable executable code (Python, Bash, Node.js).

**Use for:**

- Code repeatedly rewritten
- Complex logic that shouldn't be in markdown
- Automation scripts

**Make executable:**

```bash
chmod +x scripts/*.sh
chmod +x scripts/*.py
```

**Example:**

```
skill-name/
├── SKILL.md
└── scripts/
    ├── generate-docs.py
    └── validate.sh
```

**Agent usage:** Agent reads scripts via Read tool, executes via Bash tool.

## references/

Documentation loaded on-demand.

**Use for:**

- API schemas
- Configuration formats
- Detailed explanations
- Version-specific guides

**Example structure:**

```
skill-name/
├── SKILL.md
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

**Agent usage:** Agent loads specific reference file when needed via Read tool.

## assets/

Templates, images, fonts used in output.

**Use for:**

- File templates
- Output assets
- Static resources

**NOT for:**

- Code scripts (use `scripts/`)
- Documentation (use `references/`)

**Agent usage:** Agent reads assets on demand via Read tool or includes in generated output.

## Files NOT Allowed

Must NOT include in skill directory:

- `README.md`
- `CHANGELOG.md`
- `INSTALLATION_GUIDE.md`
- Any auxiliary documentation

These belong in project root or docs/, not in skills.

## Progressive Disclosure

Keep core workflow in SKILL.md. Move variant-specific details to references/.

**Example - Cloud Deploy Skill:**

```
cloud-deploy/
├── SKILL.md              # Core workflow + provider selection logic
└── references/
    ├── aws.md            # AWS-specific deployment steps
    ├── gcp.md            # GCP-specific deployment steps
    └── azure.md          # Azure-specific deployment steps
```

Agent loads SKILL.md for core workflow, then reads relevant provider reference.

## Freedom Level Guidelines

| Level  | Format             | When to Use                              |
| ------ | ------------------ | ---------------------------------------- |
| High   | Text instructions  | Multiple valid approaches exist          |
| Medium | Pseudocode/scripts | Preferred pattern exists                 |
| Low    | Specific scripts   | Consistency critical, fragile operations |

Match freedom level to fragility:

- **High freedom** for creative tasks (writing, design)
- **Low freedom** for operational tasks (deployments, migrations)

## Skill Discovery Path

**Project skills:** OpenCode walks up from cwd to git worktree root, loading:

- `.opencode/skills/*/SKILL.md`
- `.claude/skills/*/SKILL.md`
- `.agents/skills/*/SKILL.md`

**Global skills:** Loaded from:

- `~/.config/opencode/skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`
- `~/.agents/skills/*/SKILL.md`

## Skill vs Agent

Skills are **SOPs/workflows**, NOT agents.

| Aspect     | Skill                | Agent            |
| ---------- | -------------------- | ---------------- |
| Purpose    | Provide instructions | Act autonomously |
| Initiation | Loaded on demand     | Continuous       |
| Role       | Extend capabilities  | Take over tasks  |
| Format     | SKILL.md + resources | System prompt    |

**Skill example:** "Create a skill for API documentation" → Provides workflow for generating docs

**Agent example:** "You are an API documentation expert..." → System prompt defining role

## Naming Conventions

| Element                  | Convention         | Example                           |
| ------------------------ | ------------------ | --------------------------------- |
| Skill directory          | lowercase-hyphen   | `api-doc-generator`               |
| Skill name (frontmatter) | lowercase-hyphen   | `api-doc-generator`               |
| Scripts                  | lowercase or kebab | `generate-docs.py`, `validate.sh` |
| References               | lowercase          | `aws-deployment.md`               |
| Assets                   | Descriptive        | `react-template.zip`              |

## Complete Example

```
typescript-advanced/
├── SKILL.md
├── scripts/
│   ├── type-check.py
│   └── migrate-strict.sh
└── references/
    ├── tsconfig-guide.md
    └── utility-types.md
```
