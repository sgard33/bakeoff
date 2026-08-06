#!/usr/bin/env bash
set -euo pipefail

# Claude Code opens claudecode/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Freeze wall-clock time for the Claude Code run.
# Keep logs on stderr so Stop hooks don't surface non-JSON stdout.
node "$BAKEOFF_ROOT/stamp-duration.mjs" claudecode >&2 || true
printf '%s\n' '{"continue":true}'
