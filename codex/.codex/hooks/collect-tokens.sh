#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

node "$BAKEOFF_ROOT/collect-tokens.mjs" codex || true
