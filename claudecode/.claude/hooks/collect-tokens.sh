#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BAKEOFF_ROOT="$(cd "$ROOT/.." && pwd)"

INPUT="$(cat)"
TRANSCRIPT=""
if [ -n "$INPUT" ]; then
  TRANSCRIPT="$(printf '%s' "$INPUT" | node -e "
    let s = '';
    process.stdin.on('data', (chunk) => { s += chunk; });
    process.stdin.on('end', () => {
      try {
        process.stdout.write(JSON.parse(s).transcript_path || '');
      } catch {
        process.stdout.write('');
      }
    });
  ")"
fi

if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  node "$BAKEOFF_ROOT/record-prompt.mjs" claudecode stop --transcript "$TRANSCRIPT" >&2 || true
else
  node "$BAKEOFF_ROOT/record-prompt.mjs" claudecode stop >&2 || true
fi
printf '%s\n' '{"continue":true}'
