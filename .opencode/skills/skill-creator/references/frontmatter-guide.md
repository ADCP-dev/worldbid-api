# Frontmatter Guide

YAML frontmatter for OpenCode SKILL.md files.

## Required Format

```yaml
---
name: skill-name
description: |-
  [Multi-line description here]
---
```

## Field Specifications

### name

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Required | Yes                                        |
| Format   | Lowercase alphanumeric with single hyphens |
| Length   | 1-64 characters                            |
| Pattern  | `^[a-z0-9]+(-[a-z0-9]+)*$`                 |

**Valid names:**

- `api-handler`
- `typescript-v2`
- `db-migration`

**Invalid names:**

- `ApiHandler` (uppercase)
- `api_handler` (underscores)
- `-api-handler` (leading hyphen)
- `api--handler` (double hyphen)

**CRITICAL:** Name must match the directory name exactly.

### description

| Property | Value                   |
| -------- | ----------------------- | ------------------ |
| Required | Yes                     |
| Length   | 1-1024 characters       |
| Format   | Literal block scalar (` | -`) for multi-line |

**Must include:**

1. Action verb start (NOT "You are" or "[Role] expert")
2. Specific capabilities (NOT vague "helps with X")
3. "Use proactively when" trigger contexts
4. 3-5 concrete user: "..." → ... examples

## YAML Literal Block Scalar (`|-`)

Use `|-` for multi-line descriptions with lists:

```yaml
# ✅ CORRECT
description: |-
  Handle TypeScript type errors. Use for fixing type mismatches.

  Examples:
  - user: "Fix type error" → diagnose and fix
  - user: "Enable strict mode" → configure tsconfig
```

```yaml
# ❌ WRONG - plain YAML with colon breaks parsing
description: Handle TypeScript type errors.
Examples:
- user: "Fix type error" → diagnose

# ❌ WRONG - plain YAML (no |-)
description: |
  Handle TypeScript type errors.

  Examples:
  - user: "Fix type error" → diagnose
```

## Description Template

```
[Action verb] [capabilities]. Use for [specific cases].
Use proactively when [trigger contexts].

Examples:
- user: "[query]" → [action]
- user: "[query]" → [action]
- user: "[query]" → [action]
```

## Optional Fields

### license

```yaml
license: MIT
license: Apache-2.0
license: GPL-3.0
```

### compatibility

```yaml
compatibility: opencode
```

### metadata

```yaml
metadata:
  audience: developers
  team: platform
  version: "1.0"
```

## Complete Example

```yaml
---
name: api-doc-generator
description: |-
  Generate API documentation from OpenAPI specs. Use for creating markdown docs,
  README updates, and API reference pages. Use proactively when users mention
  "API docs", "OpenAPI", "generate documentation", or "update README".

  Examples:
  - user: "Generate docs for our API" → parse OpenAPI and create markdown
  - user: "Update API reference" → regenerate from updated spec
  - user: "Create OpenAPI from code" → analyze code and produce spec
license: MIT
compatibility: opencode
metadata:
  audience: backend-developers
  format: markdown
---
```

## Validation Checklist

- [ ] name matches directory exactly
- [ ] name is 1-64 lowercase-hyphen chars
- [ ] description uses `|-` literal block scalar
- [ ] description starts with action verb
- [ ] description has 3-5 examples in `user: "..." → ...` format
- [ ] description is 1-1024 chars
- [ ] YAML parses without errors
