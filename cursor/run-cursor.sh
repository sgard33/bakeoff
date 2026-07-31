#!/usr/bin/env bash
set -euo pipefail

# Headless Cursor bakeoff run: stream-json capture + token collection.
ROOT="$(cd "$(dirname "$0")" && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"
PROMPT_FILE="$BAKEOFF_ROOT/PROMPT.md"
LOG="$ROOT/bakeoff/run.jsonl"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Missing $PROMPT_FILE" >&2
  exit 1
fi

mkdir -p "$ROOT/bakeoff"
node "$BAKEOFF_ROOT/start-run.mjs" cursor --if-missing

PROMPT="$(cat "$PROMPT_FILE")"
cursor-agent -p --output-format stream-json "$PROMPT" | tee "$LOG"

node "$BAKEOFF_ROOT/stamp-duration.mjs" cursor || true
node "$BAKEOFF_ROOT/collect-tokens.mjs" cursor --stream-json "$LOG" || true
