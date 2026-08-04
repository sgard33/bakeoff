#!/usr/bin/env node
/**
 * Finalize timing for a harness from its run-start.json stamp.
 * Computes duration_ms, preserves any tokens already recorded (e.g. via end-run),
 * writes bakeoff/run-meta.json, then removes run-start.json so the duration is frozen.
 *
 * Usage: node stamp-duration.mjs <cursor|claudecode|codex|copilot>
 *
 * Intended for stop/afterAgent hooks — never throws, always exits 0.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { agentLog } from './.cursor/hooks/debug-log.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const harness = process.argv[2];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// #region agent log
agentLog({
  hypothesisId: 'H2',
  location: 'stamp-duration.mjs:entry',
  message: 'stamp-duration entered',
  data: { harness, cwd: process.cwd(), root },
});
// #endregion

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  // #region agent log
  agentLog({
    hypothesisId: 'H2',
    location: 'stamp-duration.mjs:bad-harness',
    message: 'stamp-duration invalid harness exit',
    data: { harness },
  });
  // #endregion
  // Nothing to do; stay quiet for hook use.
  process.exit(0);
}

const bakeoffDir = path.join(root, harness, 'bakeoff');
const startPath = path.join(bakeoffDir, 'run-start.json');
const metaPath = path.join(bakeoffDir, 'run-meta.json');

const start = readJson(startPath);
if (!start?.started_at_ms) {
  // #region agent log
  agentLog({
    hypothesisId: 'H3',
    location: 'stamp-duration.mjs:no-start',
    message: 'stamp-duration early exit missing started_at_ms',
    data: { harness, startPath, startExists: fs.existsSync(startPath), start },
  });
  // #endregion
  // No active timer (e.g. duration already stamped, or run never started).
  process.exit(0);
}

const durationMs = Math.max(0, Date.now() - Number(start.started_at_ms));

const existing = readJson(metaPath) || {};
const hasTokens = existing.tokens && Number(existing.tokens.total) > 0;
const tokens = hasTokens ? existing.tokens : { total: 0, source: 'estimated' };

const meta = {
  harness,
  duration_ms: durationMs,
  started_at: start.started_at || null,
  ended_at: new Date().toISOString(),
  tokens,
};

try {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  fs.unlinkSync(startPath);
  // #region agent log
  agentLog({
    hypothesisId: 'H3',
    location: 'stamp-duration.mjs:wrote',
    message: 'stamp-duration wrote run-meta',
    data: { harness, durationMs, metaPath, startRemoved: true, hasTokens },
  });
  // #endregion
  console.log(
    `Stamped ${harness} duration_ms=${durationMs}${hasTokens ? '' : ' (tokens pending — collect-tokens runs on stop hooks)'}`
  );
} catch (error) {
  // #region agent log
  agentLog({
    hypothesisId: 'H3',
    location: 'stamp-duration.mjs:write-error',
    message: 'stamp-duration write failed',
    data: { harness, error: String(error?.message || error) },
  });
  // #endregion
  console.error(`stamp-duration failed for ${harness}: ${error.message}`);
}

process.exit(0);
