#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Stamp the start clock on the first prompt of a build; no-op if already running.
# Codex requires valid JSON on stdout for hook events — keep logs on stderr.
node "$BAKEOFF_ROOT/start-run.mjs" codex --if-missing >&2 || true
printf '%s\n' '{"continue":true}'
