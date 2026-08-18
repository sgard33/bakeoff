#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"
PROMPT_FILE="$BAKEOFF_ROOT/PROMPT.md"
LOG="$ROOT/bakeoff/run.json"

if [ "$#" -gt 0 ]; then
  PROMPT="$*"
elif [ -f "$PROMPT_FILE" ]; then
  PROMPT="$(<"$PROMPT_FILE")"
else
  echo "Missing $PROMPT_FILE" >&2
  exit 1
fi

mkdir -p "$ROOT/bakeoff"
node "$BAKEOFF_ROOT/start-run.mjs" claudecode --if-missing

set +e
(
  cd "$ROOT"
  claude -p --output-format json "$PROMPT"
) | tee "$LOG"
STATUS=${PIPESTATUS[0]}
set -e

# Native CLI hooks normally remove this stamp. This fallback guarantees
# collection for Claude versions or modes that skip the Stop hook.
if [ -f "$ROOT/bakeoff/prompt-start.json" ]; then
  node "$BAKEOFF_ROOT/record-prompt.mjs" claudecode stop --result-json "$LOG"
fi

if [ "$STATUS" -eq 0 ]; then
  node "$BAKEOFF_ROOT/record-prompt.mjs" claudecode reconcile --result-json "$LOG"
fi

exit "$STATUS"
