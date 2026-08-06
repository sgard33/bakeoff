#!/usr/bin/env node
/**
 * Start a timed bakeoff run (manual fallback).
 * Delegates to record-prompt for cursor, claudecode, and codex.
 *
 * Usage: node start-run.mjs <cursor|claudecode|codex|copilot> [--if-missing]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const harness = process.argv[2];
const ifMissing = process.argv.includes('--if-missing');

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  console.error('Usage: node start-run.mjs <cursor|claudecode|codex|copilot> [--if-missing]');
  process.exit(ifMissing ? 0 : 1);
}

if (['cursor', 'claudecode', 'codex'].includes(harness)) {
  const promptStart = path.join(root, harness, 'bakeoff', 'prompt-start.json');
  if (ifMissing && fs.existsSync(promptStart)) {
    process.exit(0);
  }
  const result = spawnSync(process.execPath, ['record-prompt.mjs', harness, 'start'], {
    cwd: root,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

// Copilot manual timing (no CLI hooks).
const bakeoffDir = path.join(root, harness, 'bakeoff');
const startPath = path.join(bakeoffDir, 'run-start.json');

if (ifMissing && fs.existsSync(startPath)) {
  process.exit(0);
}

const startedAt = new Date().toISOString();
const payload = {
  harness,
  started_at: startedAt,
  started_at_ms: Date.now(),
};

fs.mkdirSync(bakeoffDir, { recursive: true });
fs.writeFileSync(startPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Started ${harness} run at ${startedAt}`);
console.log(`Wrote ${path.join(harness, 'bakeoff', 'run-start.json')}`);
