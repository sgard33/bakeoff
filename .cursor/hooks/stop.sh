#!/usr/bin/env bash
set -euo pipefail

BAKEOFF_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Cursor dashboard collection continues in a detached process after this returns.
node "$BAKEOFF_ROOT/metrics.mjs" stop cursor >&2 || true
