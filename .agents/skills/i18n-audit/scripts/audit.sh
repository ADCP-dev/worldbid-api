#!/bin/bash
# i18n-audit wrapper script
# Usage: bash .agents/skills/i18n-audit/scripts/audit.sh [options]
# Delegates to i18n-audit.ts

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/i18n-audit.ts" "$@"