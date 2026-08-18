#!/usr/bin/env bash
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"

# Codex Stop hooks require valid JSON on stdout — keep logs on stderr.
node "$BAKEOFF_ROOT/metrics.mjs" stop codex >&2 || true
printf '%s\n' '{"continue":true}'
