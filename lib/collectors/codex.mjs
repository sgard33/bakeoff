import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeCodexUsage } from '../normalize.mjs';

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function listRolloutFiles(sessionsRoot) {
  const files = [];
  if (!fs.existsSync(sessionsRoot)) return files;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
        files.push(full);
      }
    }
  };

  walk(sessionsRoot);
  return files;
}

function readSessionMeta(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
  if (!firstLine) return null;
  try {
    const row = JSON.parse(firstLine);
    if (row.type !== 'session_meta') return null;
    return row.payload || null;
  } catch {
    return null;
  }
}

function readLastTokenCount(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const row = JSON.parse(lines[i]);
      if (row.type !== 'event_msg') continue;
      if (row.payload?.type !== 'token_count') continue;
      const info = row.payload?.info;
      if (info?.total_token_usage) return info;
    } catch {
      // Skip malformed lines.
    }
  }
  return null;
}

/** Latest cumulative token_count from the harness rollout file. */
export function collectCodexCumulative({ harnessDir, runStartMs = null }) {
  const resolvedHarness = path.resolve(harnessDir);
  const sessionsRoot = path.join(os.homedir(), '.codex', 'sessions');
  const candidates = [];

  for (const filePath of listRolloutFiles(sessionsRoot)) {
    const meta = readSessionMeta(filePath);
    if (!meta?.cwd) continue;
    if (path.resolve(meta.cwd) !== resolvedHarness) continue;

    const stat = fs.statSync(filePath);
    const startedMs = Date.parse(meta.timestamp || '');

    if (runStartMs && stat.mtimeMs + 5 * 60_000 < runStartMs) {
      continue;
    }

    candidates.push({
      filePath,
      startedMs: Number.isFinite(startedMs) ? startedMs : stat.mtimeMs,
      mtimeMs: stat.mtimeMs,
    });
  }

  if (candidates.length === 0) {
    return { ok: false, reason: `No Codex rollout found for cwd ${resolvedHarness}` };
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.startedMs - a.startedMs);
  const chosen = candidates[0];
  const info = readLastTokenCount(chosen.filePath);
  if (!info) {
    return { ok: false, reason: `No token_count events in ${chosen.filePath}` };
  }

  return {
    ok: true,
    source: 'codex_rollout',
    rollout_path: chosen.filePath,
    tokens: normalizeCodexUsage(info.total_token_usage),
    turn_tokens: info.last_token_usage
      ? normalizeCodexUsage(info.last_token_usage)
      : null,
    raw: info.total_token_usage,
  };
}

export function collectCodexTokens({ harnessDir, runStartMs = null }) {
  return collectCodexCumulative({ harnessDir, runStartMs });
}

/** Parse a captured `codex exec --json` log (turn.completed usage lines). */
export function collectCodexFromStreamJson(filePath) {
  const lines = readJsonLines(filePath);
  let lastUsage = null;
  for (const row of lines) {
    if (row.type === 'turn.completed' && row.usage) {
      lastUsage = row.usage;
    }
  }
  if (!lastUsage) {
    return { ok: false, reason: `No turn.completed usage in ${filePath}` };
  }
  return {
    ok: true,
    source: 'codex_stream_json',
    tokens: normalizeCodexUsage(lastUsage),
    raw: lastUsage,
  };
}
