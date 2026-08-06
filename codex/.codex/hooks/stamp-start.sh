#!/usr/bin/env bash
set -euo pipefail

# Codex opens codex/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Stamp the per-prompt clock on every UserPromptSubmit.
# Codex requires valid JSON on stdout for hook events — keep logs on stderr.
node "$BAKEOFF_ROOT/record-prompt.mjs" codex start >&2 || true
printf '%s\n' '{"continue":true}'
