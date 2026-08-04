#!/usr/bin/env node
/**
 * Start a timed bakeoff run.
 * Usage: node start-run.mjs <cursor|claudecode|codex|copilot>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { agentLog } from './.cursor/hooks/debug-log.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const harness = process.argv[2];
const ifMissing = process.argv.includes('--if-missing');

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  console.error('Usage: node start-run.mjs <cursor|claudecode|codex|copilot> [--if-missing]');
  process.exit(ifMissing ? 0 : 1);
}

const bakeoffDir = path.join(root, harness, 'bakeoff');
const startPath = path.join(bakeoffDir, 'run-start.json');
const metaPath = path.join(bakeoffDir, 'run-meta.json');
const lastMetaPath = path.join(bakeoffDir, 'run-meta.last.json');

// --if-missing (used by hooks): only stamp the clock once per build. If a timer
// is already running, leave it so the first prompt of a run sets the start time.
if (ifMissing && fs.existsSync(startPath)) {
  // #region agent log
  agentLog({
    hypothesisId: 'H4',
    location: 'start-run.mjs:if-missing-skip',
    message: 'start-run skipped existing timer',
    data: { harness, ifMissing: true },
  });
  // #endregion
  process.exit(0);
}

// Hooks must not wipe a finished run on the next casual prompt. A completed
// run-meta stays until `npm run reset` or an explicit `npm run start-run -- <harness>`.
if (ifMissing && fs.existsSync(metaPath) && !fs.existsSync(startPath)) {
  // #region agent log
  agentLog({
    hypothesisId: 'H4',
    location: 'start-run.mjs:preserve-completed',
    message: 'start-run skipped; completed run-meta preserved',
    data: { harness, ifMissing: true, metaPath },
    runId: 'post-fix',
  });
  // #endregion
  process.exit(0);
}

const startedAt = new Date().toISOString();
const payload = {
  harness,
  started_at: startedAt,
  started_at_ms: Date.now(),
};

fs.mkdirSync(bakeoffDir, { recursive: true });
fs.writeFileSync(startPath, JSON.stringify(payload, null, 2) + '\n');

// Clear previous meta so a forgotten end-run cannot reuse stale timing.
// Archive first so a later prompt cannot erase the last completed capture.
const clearedMeta = fs.existsSync(metaPath);
if (clearedMeta) {
  try {
    fs.copyFileSync(metaPath, lastMetaPath);
  } catch {
    // best-effort archive
  }
  fs.unlinkSync(metaPath);
}

// #region agent log
agentLog({
  hypothesisId: 'H4',
  location: 'start-run.mjs:stamped',
  message: 'start-run wrote run-start',
  data: { harness, ifMissing, clearedMeta, archivedLast: clearedMeta, startedAt },
  runId: 'post-fix',
});
// #endregion

console.log(`Started ${harness} run at ${startedAt}`);
console.log(`Wrote ${path.join(harness, 'bakeoff', 'run-start.json')}`);
console.log('When finished: npm run collect-tokens -- ' + harness + '  (or npm run end-run -- ' + harness + ' --tokens <total>)');
