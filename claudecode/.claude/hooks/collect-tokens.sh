#!/usr/bin/env bash
set -euo pipefail

# Claude Code opens claudecode/ as the project root.
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
  node "$BAKEOFF_ROOT/collect-tokens.mjs" claudecode --transcript "$TRANSCRIPT" || true
else
  node "$BAKEOFF_ROOT/collect-tokens.mjs" claudecode || true
fi
