#!/bin/bash
# Lists all endpoints in the Foundation app with guards, roles, and validations.
# Usage: bash scripts/list-endpoints.sh [--verbose] [--json]
#
# Shows: spec-engine endpoints (from YAML) + traditional NestJS endpoints (from code).
# For each: HTTP method, path, guard type, allowed roles, validations, source file.

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT/apps/back"

ARGS=""
for arg in "$@"; do
  ARGS="$ARGS $arg"
done

node src/core/spec-engine/spec-list-endpoints.ts $ARGS