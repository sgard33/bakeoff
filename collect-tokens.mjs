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
import { spawnSync } from 'child_process';
import { loadEnv } from './lib/env.mjs';
import { computeCostUsd } from './lib/pricing.mjs';
import { collectCodexFromStreamJson, collectCodexTokens } from './lib/collectors/codex.mjs';
import { collectClaudeFromJson, collectClaudeTokens } from './lib/collectors/claude.mjs';
import {
  collectCursorFromAdminApi,
  collectCursorFromStreamJson,
} from './lib/collectors/cursor.mjs';
import { agentLog } from './.cursor/hooks/debug-log.mjs';

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
  const promptStartPath = path.join(bakeoffDir, 'prompt-start.json');

  if (fs.existsSync(promptStartPath) && !refreshCostOnly) {
    const stopArgs = ['record-prompt.mjs', harnessName, 'stop'];
    const transcript = readFlag('--transcript');
    const streamJson = readFlag('--stream-json');
    const email = readFlag('--email');
    if (transcript) stopArgs.push('--transcript', transcript);
    if (streamJson) stopArgs.push('--stream-json', streamJson);
    if (email) stopArgs.push('--email', email);

    const result = spawnSync(process.execPath, stopArgs, { cwd: root, stdio: 'inherit' });
    process.exit(result.status ?? 0);
  }

  const { startedAtMs, endedAtMs } = runWindowMs(bakeoffDir);

  if (refreshCostOnly) {
    if (harnessName !== 'cursor') {
      console.error('--refresh-cost is only supported for cursor');
      process.exit(1);
    }
    const refreshArgs = ['record-prompt.mjs', 'cursor', 'refresh'];
    const email = readFlag('--email');
    if (email) refreshArgs.push('--email', email);
    const result = spawnSync(process.execPath, refreshArgs, { cwd: root, stdio: 'inherit' });
    process.exit(result.status ?? 1);
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

    // Interactive hooks call `collect-tokens cursor` (no --stream-json) and must
    // include non-headless Admin API events. Headless runs pass --stream-json and
    // should filter to headless events if they fall back to the Admin API.
    const headlessOnly = Boolean(readFlag('--stream-json'));
    // #region agent log
    agentLog({
      hypothesisId: 'H5',
      location: 'collect-tokens.mjs:cursor-branch',
      message: 'cursor collect path',
      data: {
        startedAtMs,
        endedAtMs,
        useStreamJson: Boolean(useStreamJson),
        streamJsonExists: fs.existsSync(streamJsonPath),
        headlessOnly,
        hasApiKey: Boolean(process.env.CURSOR_ADMIN_API_KEY),
      },
      runId: 'post-fix',
    });
    // #endregion

    if (useStreamJson && fs.existsSync(streamJsonPath)) {
      result = collectCursorFromStreamJson(streamJsonPath);
    }
    if (!result?.ok && startedAtMs) {
      result = await collectCursorFromAdminApi({
        startMs: startedAtMs - 60_000,
        endMs: endedAtMs + 60_000,
        email: readFlag('--email'),
        headlessOnly,
      });
      // #region agent log
      agentLog({
        hypothesisId: 'H5',
        location: 'collect-tokens.mjs:admin-result',
        message: 'cursor admin api result',
        data: {
          ok: Boolean(result?.ok),
          reason: result?.reason || null,
          source: result?.source || null,
          eventCount: result?.event_count ?? null,
          headlessOnly,
        },
        runId: 'post-fix',
      });
      // #endregion
    }
  }

  if (!result?.ok) {
    const reason = result?.reason || `Could not collect tokens for ${harnessName}`;
    // #region agent log
    agentLog({
      hypothesisId: 'H5',
      location: 'collect-tokens.mjs:fail',
      message: 'collect-tokens failed',
      data: { harnessName, reason, startedAtMs },
      runId: 'post-fix',
    });
    // #endregion
    // Soft-exit for stop hooks when there is no active/completed timing window
    // (e.g. a second stop after stamp already removed run-start).
    if (!startedAtMs && !readFlag('--stream-json') && !readFlag('--transcript') && !readFlag('--json')) {
      console.error(reason);
      process.exit(0);
    }
    console.error(reason);
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
