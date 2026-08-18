#!/usr/bin/env bash
set -euo pipefail

HARNESS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"

node "$BAKEOFF_ROOT/metrics.mjs" start cursor >&2 || true
