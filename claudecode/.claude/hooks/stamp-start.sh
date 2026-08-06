#!/usr/bin/env bash
set -euo pipefail

# Claude Code opens claudecode/ as the project root.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

# Stamp the per-prompt clock on every UserPromptSubmit.
# UserPromptSubmit stdout is injected as model context — keep logs on stderr.
node "$BAKEOFF_ROOT/record-prompt.mjs" claudecode start >&2 || true
