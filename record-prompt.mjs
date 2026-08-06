#!/usr/bin/env node
/**
 * Per-prompt metrics: start/stop hooks append to prompts.jsonl and update totals.json.
 *
 * Usage:
 *   node record-prompt.mjs <cursor|claudecode|codex|copilot> start
 *   node record-prompt.mjs <cursor|claudecode|codex> stop [--transcript path] [--stream-json path] [--email email]
 *   node record-prompt.mjs cursor refresh [--email email]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/env.mjs';
import { computeCostUsd } from './lib/pricing.mjs';
import { subtractTokens } from './lib/token-delta.mjs';
import { collectCodexCumulative, collectCodexFromStreamJson } from './lib/collectors/codex.mjs';
import { collectClaudeTurnUsage } from './lib/collectors/claude.mjs';
import {
  collectCursorFromAdminApi,
  collectCursorFromStreamJson,
} from './lib/collectors/cursor.mjs';
import {
  formatTotalsLine,
  formatTurnLine,
  nextPromptIndex,
  pathsForHarness,
  readJson,
  readTotals,
  readUsageSnapshot,
  recordTurn,
  writeJson,
} from './lib/prompt-log.mjs';

loadEnv();

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const harness = args[0];
const action = args[1];

const SUPPORTED = ['cursor', 'claudecode', 'codex', 'copilot'];

function readFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function roundCost(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function resolveCost(tokens, harnessName, reportedUsd, priorReportedUsd, adminUsd) {
  if (reportedUsd != null && priorReportedUsd != null) {
    const delta = Math.max(0, reportedUsd - priorReportedUsd);
    if (delta > 0) {
      return { cost_usd: roundCost(delta), cost_source: 'reported' };
    }
  }
  if (reportedUsd != null && priorReportedUsd == null) {
    return { cost_usd: roundCost(reportedUsd), cost_source: 'reported' };
  }
  if (adminUsd != null) {
    return { cost_usd: roundCost(adminUsd), cost_source: 'admin_api' };
  }
  return {
    cost_usd: computeCostUsd(tokens, harnessName),
    cost_source: 'computed',
  };
}

function startPrompt(harnessName) {
  const paths = pathsForHarness(root, harnessName);
  const totals = readTotals(paths.totals);
  const promptIndex = nextPromptIndex(totals);
  const startedAt = new Date().toISOString();
  const payload = {
    harness: harnessName,
    prompt_index: promptIndex,
    started_at: startedAt,
    started_at_ms: Date.now(),
  };

  writeJson(paths.promptStart, payload);
  console.error(`Started ${harnessName} prompt #${promptIndex} at ${startedAt}`);
}

async function collectTurnTokens(harnessName, paths, promptStart, snapshot) {
  const harnessDir = path.join(root, harnessName);
  const startedAtMs = Number(promptStart.started_at_ms);
  const endedAtMs = Date.now();
  const streamJsonPath = readFlag('--stream-json') || paths.streamJson;

  if (harnessName === 'claudecode') {
    const result = collectClaudeTurnUsage({
      harnessDir,
      transcriptPath: readFlag('--transcript'),
      runStartMs: startedAtMs,
      seenMessageIds: snapshot.seen_message_ids,
    });
    if (!result.ok) return result;

    const { cost_usd, cost_source } = resolveCost(
      result.tokens,
      harnessName,
      result.reported_cost_usd,
      snapshot.reported_cost_usd,
      null
    );

    return {
      ok: true,
      tokens: result.tokens,
      token_source: result.source,
      cost_usd,
      cost_source,
      snapshotPatch: {
        tokens: result.cumulative_tokens,
        seen_message_ids: result.seen_message_ids,
        reported_cost_usd: result.reported_cost_usd,
        transcript_path: result.transcript_path,
      },
    };
  }

  if (harnessName === 'codex') {
    let cumulative = null;
    if (readFlag('--stream-json') && fs.existsSync(streamJsonPath)) {
      cumulative = collectCodexFromStreamJson(streamJsonPath);
    } else {
      cumulative = collectCodexCumulative({ harnessDir, runStartMs: startedAtMs });
    }
    if (!cumulative?.ok) return cumulative;

    const tokens = subtractTokens(cumulative.tokens, snapshot.tokens);
    const { cost_usd, cost_source } = resolveCost(tokens, harnessName, null, null, null);

    return {
      ok: true,
      tokens,
      token_source: cumulative.source,
      cost_usd,
      cost_source,
      snapshotPatch: {
        tokens: cumulative.tokens,
        rollout_path: cumulative.rollout_path || snapshot.rollout_path || null,
      },
    };
  }

  if (harnessName === 'cursor') {
    const useStreamJson =
      readFlag('--stream-json') ||
      (fs.existsSync(streamJsonPath) &&
        fs.statSync(streamJsonPath).mtimeMs >= startedAtMs - 60_000);

    if (useStreamJson && fs.existsSync(streamJsonPath)) {
      const stream = collectCursorFromStreamJson(streamJsonPath);
      if (!stream.ok) return stream;
      const { cost_usd, cost_source } = resolveCost(stream.tokens, harnessName, null, null, null);
      return {
        ok: true,
        tokens: stream.tokens,
        token_source: stream.source,
        cost_usd,
        cost_source,
        snapshotPatch: { tokens: stream.tokens },
      };
    }

    const admin = await collectCursorFromAdminApi({
      startMs: startedAtMs,
      endMs: endedAtMs,
      email: readFlag('--email'),
      headlessOnly: false,
    });
    if (!admin.ok) return admin;

    const tokens = subtractTokens(admin.tokens, snapshot.tokens);
    const priorAdminCost = snapshot.admin_cost_usd ?? 0;
    const adminDelta = Math.max(0, (admin.cost_usd || 0) - priorAdminCost);
    const { cost_usd, cost_source } = resolveCost(
      tokens,
      harnessName,
      null,
      null,
      adminDelta > 0 ? adminDelta : admin.cost_usd
    );

    return {
      ok: true,
      tokens,
      token_source: admin.source,
      cost_usd,
      cost_source,
      snapshotPatch: {
        tokens: admin.tokens,
        admin_cost_usd: admin.cost_usd,
      },
    };
  }

  return { ok: false, reason: `Token collection not implemented for ${harnessName}` };
}

async function stopPrompt(harnessName) {
  const paths = pathsForHarness(root, harnessName);
  const promptStart = readJson(paths.promptStart);

  if (!promptStart?.started_at_ms) {
    console.error(`No active prompt timer for ${harnessName}; skipping stop`);
    process.exit(0);
  }

  const snapshot = readUsageSnapshot(paths.usageSnapshot);
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - Number(promptStart.started_at_ms));

  const collected = await collectTurnTokens(harnessName, paths, promptStart, snapshot);
  if (!collected.ok) {
    console.error(collected.reason || `Could not collect tokens for ${harnessName}`);
    if (harnessName === 'copilot') {
      process.exit(1);
    }

    const fallbackTurn = {
      harness: harnessName,
      prompt_index: promptStart.prompt_index,
      started_at: promptStart.started_at,
      ended_at: endedAt,
      duration_ms: durationMs,
      tokens: {
        input: 0,
        cached_input: 0,
        cache_write_input: 0,
        output: 0,
        reasoning_output: 0,
        total: 0,
        source: 'estimated',
      },
      cost_usd: 0,
      cost_source: 'computed',
      token_source: 'unavailable',
      collection_error: collected.reason || null,
    };

    const { totals } = recordTurn({
      root,
      harness: harnessName,
      turn: fallbackTurn,
      snapshotPatch: snapshot,
    });

    console.error(formatTurnLine(harnessName, fallbackTurn));
    console.error(formatTotalsLine(harnessName, totals));
    process.exit(0);
  }

  const turn = {
    harness: harnessName,
    prompt_index: promptStart.prompt_index,
    started_at: promptStart.started_at,
    ended_at: endedAt,
    duration_ms: durationMs,
    tokens: collected.tokens,
    cost_usd: collected.cost_usd,
    cost_source: collected.cost_source,
    token_source: collected.token_source,
  };

  const { totals } = recordTurn({
    root,
    harness: harnessName,
    turn,
    snapshotPatch: collected.snapshotPatch,
  });

  console.error(formatTurnLine(harnessName, turn));
  console.error(formatTotalsLine(harnessName, totals));
}

async function refreshCursorCost() {
  const harnessName = 'cursor';
  const paths = pathsForHarness(root, harnessName);
  const totals = readTotals(paths.totals);
  const prompts = [];

  if (fs.existsSync(paths.promptsLog)) {
    for (const line of fs.readFileSync(paths.promptsLog, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        prompts.push(JSON.parse(line));
      } catch {
        // skip malformed
      }
    }
  }

  const firstStarted = prompts[0]?.started_at
    ? Date.parse(prompts[0].started_at)
    : totals.started_at
      ? Date.parse(totals.started_at)
      : null;
  const lastEnded = totals.last_ended_at ? Date.parse(totals.last_ended_at) : Date.now();

  if (!firstStarted) {
    console.error('No prompt history to refresh cost against');
    process.exit(1);
  }

  const admin = await collectCursorFromAdminApi({
    startMs: firstStarted,
    endMs: lastEnded,
    email: readFlag('--email'),
    headlessOnly: false,
  });

  if (!admin.ok) {
    console.error(admin.reason);
    process.exit(1);
  }

  totals.cost_usd = admin.cost_usd;
  writeJson(paths.totals, totals);

  const runMeta = readJson(paths.runMeta) || { harness: harnessName };
  runMeta.cost_usd = admin.cost_usd;
  runMeta.cost_source = 'admin_api';
  writeJson(paths.runMeta, runMeta);

  console.error(`Refreshed cursor cost_usd=${admin.cost_usd} (${admin.event_count} events)`);
}

async function main() {
  if (!SUPPORTED.includes(harness)) {
    console.error(
      'Usage: node record-prompt.mjs <cursor|claudecode|codex|copilot> <start|stop|refresh> [--transcript path] [--stream-json path] [--email email]'
    );
    process.exit(1);
  }

  if (action === 'start') {
    startPrompt(harness);
    process.exit(0);
  }

  if (action === 'stop') {
    await stopPrompt(harness);
    process.exit(0);
  }

  if (action === 'refresh') {
    if (harness !== 'cursor') {
      console.error('refresh is only supported for cursor');
      process.exit(1);
    }
    await refreshCursorCost();
    process.exit(0);
  }

  console.error(
    'Usage: node record-prompt.mjs <cursor|claudecode|codex|copilot> <start|stop|refresh> [--transcript path] [--stream-json path] [--email email]'
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(`record-prompt failed: ${error.message}`);
  process.exit(1);
});
