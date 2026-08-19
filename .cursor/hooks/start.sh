#!/usr/bin/env bash
set -euo pipefail

BAKEOFF_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

node "$BAKEOFF_ROOT/metrics.mjs" start cursor >&2 || true
