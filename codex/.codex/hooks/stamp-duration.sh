#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Freeze wall-clock time for the Codex run.
# Codex Stop hooks require valid JSON on stdout — keep logs on stderr.
node "$BAKEOFF_ROOT/stamp-duration.mjs" codex >&2 || true
printf '%s\n' '{"continue":true}'
