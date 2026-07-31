#!/usr/bin/env node
/**
 * Finish a timed bakeoff run and write bakeoff/run-meta.json.
 *
 * Usage:
 *   node end-run.mjs <cursor|claudecode|codex|copilot> --tokens 9600
 *   node end-run.mjs cursor --tokens 9600 --input 6200 --output 3400 --source exact
 *   node end-run.mjs codex --tokens 2182689 --input 112411 --cached-input 2059008 --output 11270 --reasoning 2802 --cost 12.34
 *   node end-run.mjs claudecode --duration-ms 45000 --tokens 12000
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const harness = args[0];

function readFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

if (!['cursor', 'claudecode', 'codex', 'copilot'].includes(harness)) {
  console.error(
    'Usage: node end-run.mjs <cursor|claudecode|codex|copilot> --tokens <total> [--input N --output N --cached-input N --cache-write N --reasoning N --cost N] [--duration-ms N] [--source exact|estimated] [--cost-source reported|computed|admin_api]'
  );
  process.exit(1);
}

const bakeoffDir = path.join(root, harness, 'bakeoff');
const start = readJson(path.join(bakeoffDir, 'run-start.json'));

const tokensTotal = Number(readFlag('--tokens') ?? 0);
const tokensInput = Number(readFlag('--input') ?? 0);
const tokensOutput = Number(readFlag('--output') ?? 0);
const tokensCached = Number(readFlag('--cached-input') ?? 0);
const tokensCacheWrite = Number(readFlag('--cache-write') ?? 0);
const tokensReasoning = Number(readFlag('--reasoning') ?? 0);
const costUsd = readFlag('--cost');
const costSource = readFlag('--cost-source');
const source = readFlag('--source') || (tokensTotal > 0 ? 'exact' : 'estimated');
const overrideDuration = readFlag('--duration-ms');

const existingMeta = readJson(path.join(bakeoffDir, 'run-meta.json'));

let durationMs = 0;
if (overrideDuration != null) {
  durationMs = Number(overrideDuration);
} else if (start?.started_at_ms) {
  durationMs = Math.max(0, Date.now() - Number(start.started_at_ms));
} else if (existingMeta?.duration_ms) {
  durationMs = Number(existingMeta.duration_ms);
} else {
  console.error(
    `No timing for ${harness}. Run npm run start-run -- ${harness} first, or pass --duration-ms.`
  );
  process.exit(1);
}

if (!tokensTotal) {
  console.error('Missing --tokens <total>. Example: npm run end-run -- cursor --tokens 9600');
  process.exit(1);
}

const tokens = {
  input: tokensInput || undefined,
  cached_input: tokensCached || undefined,
  cache_write_input: tokensCacheWrite || undefined,
  output: tokensOutput || undefined,
  reasoning_output: tokensReasoning || undefined,
  total: tokensTotal,
  source,
};

const meta = {
  harness,
  duration_ms: durationMs,
  started_at: start?.started_at || existingMeta?.started_at || null,
  ended_at: new Date().toISOString(),
  tokens: Object.fromEntries(Object.entries(tokens).filter(([, v]) => v !== undefined)),
};

if (costUsd != null) {
  meta.cost_usd = Number(costUsd);
  meta.cost_source = costSource || 'reported';
}

fs.mkdirSync(bakeoffDir, { recursive: true });
fs.writeFileSync(path.join(bakeoffDir, 'run-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

const startPath = path.join(bakeoffDir, 'run-start.json');
if (fs.existsSync(startPath)) fs.unlinkSync(startPath);

console.log(`Ended ${harness} run`);
console.log(`- duration_ms: ${durationMs}`);
console.log(`- tokens.total: ${tokensTotal} (${source})`);
if (meta.cost_usd != null) console.log(`- cost_usd: ${meta.cost_usd}`);
console.log(`Wrote ${path.join(harness, 'bakeoff', 'run-meta.json')}`);
