#!/bin/bash
# new-skill.sh - Scaffold a new OpenCode skill
# Usage: ./new-skill.sh <skill-name> [--project | --global]
# Example: ./new-skill.sh my-api-handler --project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_CREATOR_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$(dirname "$SKILL_CREATOR_DIR")"

show_usage() {
    cat <<EOF
Usage: $(basename "$0") <skill-name> [--project | --global]

Create a new OpenCode skill scaffold.

Arguments:
  skill-name          Name of the skill (lowercase-hyphen format)

Options:
  --project          Create in .opencode/skills/ (default)
  --global           Create in ~/.config/opencode/skills/

Examples:
  $(basename "$0") my-api-handler
  $(basename "$0") typescript-advanced --project
  $(basename "$0") pdf-editor --global

EOF
}

validate_name() {
    local name="$1"
    if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
        echo "Error: Invalid skill name '$name'"
        echo "Must match: ^[a-z0-9]+(-[a-z0-9]+)*$"
        echo "  - Lowercase alphanumeric with single hyphens"
        echo "  - No leading/trailing hyphens"
        echo "  - No consecutive hyphens"
        exit 1
    fi
    if [[ ${#name} -gt 64 ]]; then
        echo "Error: Skill name too long (${#name}/64 chars)"
        exit 1
    fi
}

create_skill_dir() {
    local skill_name="$1"
    local scope="$2"
    local parent_dir

    if [[ "$scope" == "global" ]]; then
        parent_dir="$HOME/.config/opencode/skills"
    else
        parent_dir="$SKILLS_DIR/.opencode/skills"
    fi

    local skill_dir="$parent_dir/$skill_name"

    if [[ -d "$skill_dir" ]]; then
        echo "Error: Skill directory already exists: $skill_dir"
        exit 1
    fi

    mkdir -p "$skill_dir/scripts" "$skill_dir/references" "$skill_dir/assets"
    echo "Created: $skill_dir"
    echo "$skill_dir"  # Output for capture
}

create_skill_md() {
    local skill_dir="$1"
    local skill_name="$2"

    cat > "$skill_dir/SKILL.md" <<EOF
---
name: $skill_name
description: |-
  [One line summary of what this skill does]. Use for [specific cases].
  Use proactively when [trigger contexts].

  Examples:
  - user: "[example query]" → [expected action]
  - user: "[example query]" → [expected action]
  - user: "[example query]" → [expected action]
---

# $skill_name

## Overview

[What this skill does in 1-2 sentences]

## When to Use

[Specific use cases - what requests should trigger this skill]

## Instructions

[Step-by-step workflow or main instructions]

## Examples

### Example 1: [Title]
[Description of the workflow]

### Example 2: [Title]
[Description of the workflow]

## Troubleshooting

[Common issues and solutions]

## See Also

[Any related skills or resources]
EOF
    echo "Created: $skill_dir/SKILL.md"
}

main() {
    local skill_name=""
    local scope="project"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --project)
                scope="project"
                shift
                ;;
            --global)
                scope="global"
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                echo "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$skill_name" ]]; then
                    skill_name="$1"
                else
                    echo "Error: Multiple skill names provided"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$skill_name" ]]; then
        echo "Error: Skill name required"
        show_usage
        exit 1
    fi

    validate_name "$skill_name"
    local skill_dir
    skill_dir=$(create_skill_dir "$skill_name" "$scope")
    create_skill_md "$skill_dir" "$skill_name"

    cat <<EOF

Skill scaffold created successfully!

Location: $skill_dir
Structure:
  $skill_dir/
  ├── SKILL.md
  ├── scripts/
  ├── references/
  └── assets/

Next steps:
  1. Edit $skill_dir/SKILL.md with your skill content
  2. Add scripts to $skill_dir/scripts/ if needed
  3. Add references to $skill_dir/references/ if needed
  4. Run: .opencode/skills/skill-creator/scripts/validate-skill.sh $skill_dir

EOF
}

main "$@"
