#!/bin/bash
# Validates a spec YAML file against Foundation spec-engine rules.
# Usage: bash scripts/validate-spec.sh <extension> [resource]
# Exit 0 = valid, Exit 1 = errors found
#
# Checks: YAML parseable, required fields (name, table, fields),
# field types valid, enum has values, ref has target, permissions
# complete, hook files exist, handler files exist, template files exist.

EXT="$1"
RESOURCE="$2"

if [ -z "$EXT" ]; then
  echo "Usage: bash scripts/validate-spec.sh <extension> [resource]"
  echo "Example: bash scripts/validate-spec.sh tasks"
  echo "Example: bash scripts/validate-spec.sh tasks task"
  exit 1
fi

# Find repo root (4 levels up from scripts/: scripts/ → foundation-agent/ → skills/ → .agents/ → repo root)
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT/apps/back"

if [ -n "$RESOURCE" ]; then
  node src/core/spec-engine/spec-validate.ts "$EXT" --verbose 2>&1 | grep "$RESOURCE"
else
  node src/core/spec-engine/spec-validate.ts "$EXT" --verbose
fi

exit $?