#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

node "$BAKEOFF_ROOT/record-prompt.mjs" codex start >&2 || true
printf '%s\n' '{"continue":true}'
