#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"
PROMPT_FILE="$BAKEOFF_ROOT/PROMPT.md"
LOG="$ROOT/bakeoff/run.jsonl"

if [ "$#" -gt 0 ]; then
  PROMPT="$*"
elif [ -f "$PROMPT_FILE" ]; then
  PROMPT="$(<"$PROMPT_FILE")"
else
  echo "Missing $PROMPT_FILE" >&2
  exit 1
fi

mkdir -p "$ROOT/bakeoff"
node "$BAKEOFF_ROOT/start-run.mjs" codex --if-missing

set +e
(
  cd "$ROOT"
  codex exec --json "$PROMPT"
) | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

# Native CLI hooks normally remove this stamp. This fallback guarantees
# collection when project hooks have not yet been trusted.
if [ -f "$ROOT/bakeoff/prompt-start.json" ]; then
  node "$BAKEOFF_ROOT/record-prompt.mjs" codex stop --stream-json "$LOG"
fi

exit "$STATUS"
