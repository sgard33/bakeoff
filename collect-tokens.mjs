#!/usr/bin/env node
/**
 * Collect exact token usage (+ cost when available) from CLI telemetry and
 * merge into <harness>/bakeoff/run-meta.json.
 *
 * Usage:
 *   node collect-tokens.mjs <cursor|claudecode|codex>
 *   node collect-tokens.mjs claudecode --transcript /path/to/session.jsonl
 *   node collect-tokens.mjs cursor --stream-json cursor/bakeoff/run.jsonl
 *   node collect-tokens.mjs cursor --refresh-cost
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/env.mjs';
import { computeCostUsd } from './lib/pricing.mjs';
import { collectCodexFromStreamJson, collectCodexTokens } from './lib/collectors/codex.mjs';
import { collectClaudeFromJson, collectClaudeTokens } from './lib/collectors/claude.mjs';
import {
  collectCursorFromAdminApi,
  collectCursorFromStreamJson,
} from './lib/collectors/cursor.mjs';

loadEnv();

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const harness = args[0];
const refreshCostOnly = args.includes('--refresh-cost');

const SUPPORTED = ['cursor', 'claudecode', 'codex'];

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

function runWindowMs(bakeoffDir) {
  const start = readJson(path.join(bakeoffDir, 'run-start.json'));
  const meta = readJson(path.join(bakeoffDir, 'run-meta.json'));

  const startedAtMs =
    Number(start?.started_at_ms) ||
    Date.parse(start?.started_at || meta?.started_at || '') ||
    null;
  const endedAtMs = Date.parse(meta?.ended_at || '') || Date.now();

  return { startedAtMs, endedAtMs, start, meta };
}

function mergeRunMeta(harnessName, bakeoffDir, patch) {
  const metaPath = path.join(bakeoffDir, 'run-meta.json');
  const existing = readJson(metaPath) || { harness: harnessName };

  const merged = {
    ...existing,
    harness: harnessName,
    ...patch,
    tokens: {
      ...(existing.tokens || {}),
      ...(patch.tokens || {}),
    },
  };

  if (patch.cost_usd != null) merged.cost_usd = patch.cost_usd;
  if (patch.cost_source) merged.cost_source = patch.cost_source;
  if (patch.token_source) merged.token_source = patch.token_source;

  fs.mkdirSync(bakeoffDir, { recursive: true });
  fs.writeFileSync(metaPath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

function defaultStreamJsonPath(harnessName) {
  return path.join(root, harnessName, 'bakeoff', 'run.jsonl');
}

async function collectForHarness(harnessName) {
  const harnessDir = path.join(root, harnessName);
  const bakeoffDir = path.join(harnessDir, 'bakeoff');
  const { startedAtMs, endedAtMs } = runWindowMs(bakeoffDir);

  if (refreshCostOnly) {
    if (harnessName !== 'cursor') {
      console.error('--refresh-cost is only supported for cursor');
      process.exit(1);
    }
    if (!startedAtMs) {
      console.error('No run timing found; start a run before refreshing cost');
      process.exit(1);
    }
    const admin = await collectCursorFromAdminApi({
      startMs: startedAtMs - 60_000,
      endMs: endedAtMs + 60_000,
      email: readFlag('--email'),
      headlessOnly: false,
    });
    if (!admin.ok) {
      console.error(admin.reason);
      process.exit(1);
    }
    const merged = mergeRunMeta(harnessName, bakeoffDir, {
      cost_usd: admin.cost_usd,
      cost_source: 'admin_api',
    });
    console.log(`Refreshed ${harnessName} cost_usd=${admin.cost_usd} (${admin.event_count} events)`);
    console.log(`Wrote ${path.join(harnessName, 'bakeoff', 'run-meta.json')}`);
    return merged;
  }

  const streamJsonPath = readFlag('--stream-json') || defaultStreamJsonPath(harnessName);
  let result = null;

  if (harnessName === 'codex') {
    if (readFlag('--stream-json') && fs.existsSync(streamJsonPath)) {
      result = collectCodexFromStreamJson(streamJsonPath);
    } else {
      result = collectCodexTokens({ harnessDir, runStartMs: startedAtMs });
    }
  } else if (harnessName === 'claudecode') {
    const jsonPath = readFlag('--json');
    if (jsonPath && fs.existsSync(jsonPath)) {
      result = collectClaudeFromJson(jsonPath);
    } else {
      result = collectClaudeTokens({
        harnessDir,
        transcriptPath: readFlag('--transcript'),
        runStartMs: startedAtMs,
      });
    }
  } else if (harnessName === 'cursor') {
    const useStreamJson =
      readFlag('--stream-json') ||
      (fs.existsSync(streamJsonPath) &&
        (!startedAtMs || fs.statSync(streamJsonPath).mtimeMs >= startedAtMs - 60_000));

    if (useStreamJson && fs.existsSync(streamJsonPath)) {
      result = collectCursorFromStreamJson(streamJsonPath);
    }
    if (!result?.ok && startedAtMs) {
      result = await collectCursorFromAdminApi({
        startMs: startedAtMs - 60_000,
        endMs: endedAtMs + 60_000,
        email: readFlag('--email'),
        headlessOnly: !readFlag('--stream-json'),
      });
    }
  }

  if (!result?.ok) {
    console.error(result?.reason || `Could not collect tokens for ${harnessName}`);
    process.exit(1);
  }

  let costUsd = null;
  let costSource = 'computed';

  if (result.reported_cost_usd != null) {
    costUsd = result.reported_cost_usd;
    costSource = 'reported';
  } else if (result.cost_usd != null) {
    costUsd = result.cost_usd;
    costSource = result.source === 'cursor_admin_api' ? 'admin_api' : 'reported';
  } else {
    costUsd = computeCostUsd(result.tokens, harnessName);
    costSource = 'computed';
  }

  const patch = {
    tokens: result.tokens,
    cost_usd: costUsd,
    cost_source: costSource,
    token_source: result.source,
  };

  if (result.duration_ms != null) {
    patch.duration_ms = result.duration_ms;
  }

  const merged = mergeRunMeta(harnessName, bakeoffDir, patch);
  console.log(`Collected ${harnessName} tokens from ${result.source}`);
  console.log(`- total: ${result.tokens.total}`);
  console.log(`- cost_usd: ${costUsd} (${costSource})`);
  console.log(`Wrote ${path.join(harnessName, 'bakeoff', 'run-meta.json')}`);
  return merged;
}

if (!SUPPORTED.includes(harness)) {
  console.error(
    'Usage: node collect-tokens.mjs <cursor|claudecode|codex> [--transcript path] [--stream-json path] [--json path] [--email email] [--refresh-cost]'
  );
  process.exit(1);
}

collectForHarness(harness).catch((error) => {
  console.error(`collect-tokens failed: ${error.message}`);
  process.exit(1);
});
