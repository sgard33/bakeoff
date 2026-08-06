import fs from 'fs';
import path from 'path';
import { addTokens, emptyTokens } from './token-delta.mjs';

export function bakeoffDir(root, harness) {
  return path.join(root, harness, 'bakeoff');
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`);
}

export function pathsForHarness(root, harness) {
  const dir = bakeoffDir(root, harness);
  return {
    dir,
    promptStart: path.join(dir, 'prompt-start.json'),
    usageSnapshot: path.join(dir, 'usage-snapshot.json'),
    promptsLog: path.join(dir, 'prompts.jsonl'),
    totals: path.join(dir, 'totals.json'),
    runMeta: path.join(dir, 'run-meta.json'),
    streamJson: path.join(dir, 'run.jsonl'),
  };
}

export function readTotals(totalsPath) {
  const existing = readJson(totalsPath);
  if (!existing) {
    return {
      harness: null,
      prompt_count: 0,
      duration_ms: 0,
      cost_usd: 0,
      tokens: emptyTokens(),
      started_at: null,
      last_ended_at: null,
    };
  }
  return {
    ...existing,
    tokens: { ...emptyTokens(), ...(existing.tokens || {}) },
  };
}

export function readUsageSnapshot(snapshotPath) {
  const snap = readJson(snapshotPath);
  if (!snap) {
    return {
      tokens: emptyTokens(),
      seen_message_ids: [],
      reported_cost_usd: null,
    };
  }
  return {
    tokens: { ...emptyTokens(), ...(snap.tokens || {}) },
    seen_message_ids: Array.isArray(snap.seen_message_ids) ? snap.seen_message_ids : [],
    reported_cost_usd: snap.reported_cost_usd ?? null,
    rollout_path: snap.rollout_path || null,
    transcript_path: snap.transcript_path || null,
    admin_cost_usd: snap.admin_cost_usd ?? null,
  };
}

export function writeUsageSnapshot(snapshotPath, patch) {
  writeJson(snapshotPath, patch);
}

export function nextPromptIndex(totals) {
  return (Number(totals?.prompt_count) || 0) + 1;
}

export function recordTurn({ root, harness, turn, snapshotPatch }) {
  const paths = pathsForHarness(root, harness);
  appendJsonl(paths.promptsLog, turn);

  const totals = readTotals(paths.totals);
  const updatedTotals = {
    harness,
    prompt_count: (totals.prompt_count || 0) + 1,
    duration_ms: (totals.duration_ms || 0) + (turn.duration_ms || 0),
    cost_usd: Math.round(((totals.cost_usd || 0) + (turn.cost_usd || 0)) * 1_000_000) / 1_000_000,
    tokens: addTokens(totals.tokens, turn.tokens),
    started_at: totals.started_at || turn.started_at,
    last_ended_at: turn.ended_at,
    last_prompt_index: turn.prompt_index,
  };

  writeJson(paths.totals, updatedTotals);

  const runMeta = {
    harness,
    duration_ms: updatedTotals.duration_ms,
    started_at: updatedTotals.started_at,
    ended_at: updatedTotals.last_ended_at,
    cost_usd: updatedTotals.cost_usd,
    cost_source: turn.cost_source,
    token_source: turn.token_source,
    prompt_count: updatedTotals.prompt_count,
    tokens: updatedTotals.tokens,
  };
  writeJson(paths.runMeta, runMeta);

  if (snapshotPatch) {
    writeUsageSnapshot(paths.usageSnapshot, snapshotPatch);
  }

  if (fs.existsSync(paths.promptStart)) {
    fs.unlinkSync(paths.promptStart);
  }

  return { turn, totals: updatedTotals, paths };
}

export function formatTurnLine(harness, turn) {
  const t = turn.tokens || emptyTokens();
  const secs = ((turn.duration_ms || 0) / 1000).toFixed(1);
  const cost = turn.cost_usd != null ? `$${turn.cost_usd}` : '$?';
  return (
    `[${harness}] prompt #${turn.prompt_index}  ${secs}s  ` +
    `in=${t.input} cache_r=${t.cached_input} cache_w=${t.cache_write_input} out=${t.output}  ${cost}`
  );
}

export function formatTotalsLine(harness, totals) {
  const secs = ((totals.duration_ms || 0) / 1000).toFixed(1);
  const cost = totals.cost_usd != null ? `$${totals.cost_usd}` : '$?';
  return (
    `[${harness}] totals     ${totals.prompt_count} prompts  ${secs}s  ` +
    `tokens=${totals.tokens?.total || 0}  ${cost}`
  );
}
