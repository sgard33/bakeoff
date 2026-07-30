#!/usr/bin/env node
/**
 * Start a timed bakeoff run.
 * Usage: node start-run.mjs <cursor|claudecode|codex|copilot>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const harness = process.argv[2];
const ifMissing = process.argv.includes('--if-missing');

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  console.error('Usage: node start-run.mjs <cursor|claudecode|codex|copilot> [--if-missing]');
  process.exit(ifMissing ? 0 : 1);
}

const bakeoffDir = path.join(root, harness, 'bakeoff');

// --if-missing (used by hooks): only stamp the clock once per build. If a timer
// is already running, leave it so the first prompt of a run sets the start time.
if (ifMissing && fs.existsSync(path.join(bakeoffDir, 'run-start.json'))) {
  process.exit(0);
}

const startedAt = new Date().toISOString();
const payload = {
  harness,
  started_at: startedAt,
  started_at_ms: Date.now(),
};

fs.mkdirSync(bakeoffDir, { recursive: true });
fs.writeFileSync(path.join(bakeoffDir, 'run-start.json'), JSON.stringify(payload, null, 2) + '\n');

// Clear previous meta so a forgotten end-run cannot reuse stale timing.
const metaPath = path.join(bakeoffDir, 'run-meta.json');
if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

console.log(`Started ${harness} run at ${startedAt}`);
console.log(`Wrote ${path.join(harness, 'bakeoff', 'run-start.json')}`);
console.log('When finished: npm run end-run -- ' + harness + ' --tokens <total> [--input N --output N]');
