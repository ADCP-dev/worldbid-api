#!/bin/bash
# Lists ALL tables in Foundation (spec-engine + traditional NestJS).
# Shows: table name, source (spec-engine YAML or traditional entity),
# columns with types, relations, permissions, hooks, actions, jobs.
#
# Usage: bash scripts/list-tables.sh [--json] [prefix]
# Example: bash scripts/list-tables.sh              # all 47 tables
# Example: bash scripts/list-tables.sh ext_tasks   # only tasks tables
# Example: bash scripts/list-tables.sh --json      # JSON output

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT/apps/back"

ARGS=""
for arg in "$@"; do
  ARGS="$ARGS $arg"
done

node src/core/spec-engine/spec-list-tables.ts $ARGS