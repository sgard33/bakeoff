#!/usr/bin/env bash
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"

# UserPromptSubmit stdout is injected as model context — keep logs on stderr.
node "$BAKEOFF_ROOT/metrics.mjs" start claudecode >&2 || true
