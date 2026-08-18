#!/usr/bin/env bash
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"

# Codex requires valid JSON on stdout for hook events — keep logs on stderr.
node "$BAKEOFF_ROOT/metrics.mjs" start codex >&2 || true
printf '%s\n' '{"continue":true}'
