#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Freeze wall-clock time for the Codex run.
node "$BAKEOFF_ROOT/stamp-duration.mjs" codex || true
