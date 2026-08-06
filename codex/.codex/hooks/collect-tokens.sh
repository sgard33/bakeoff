#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Codex Stop hooks require valid JSON on stdout — keep logs on stderr.
node "$BAKEOFF_ROOT/record-prompt.mjs" codex stop >&2 || true
printf '%s\n' '{"continue":true}'
