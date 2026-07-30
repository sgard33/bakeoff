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

const root = path.dirname(fileURLToPath(import.meta.url));
const harness = process.argv[2];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  // Nothing to do; stay quiet for hook use.
  process.exit(0);
}

const bakeoffDir = path.join(root, harness, 'bakeoff');
const startPath = path.join(bakeoffDir, 'run-start.json');
const metaPath = path.join(bakeoffDir, 'run-meta.json');

const start = readJson(startPath);
if (!start?.started_at_ms) {
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
  console.log(
    `Stamped ${harness} duration_ms=${durationMs}${hasTokens ? '' : ' (tokens still estimated — add with end-run)'}`
  );
} catch (error) {
  console.error(`stamp-duration failed for ${harness}: ${error.message}`);
}

process.exit(0);
