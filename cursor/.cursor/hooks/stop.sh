#!/usr/bin/env bash
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"

# Cursor dashboard collection continues in a detached process after this returns.
node "$BAKEOFF_ROOT/metrics.mjs" stop cursor >&2 || true
