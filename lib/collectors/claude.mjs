import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeClaudeUsage } from '../normalize.mjs';

export function claudeProjectSlug(absPath) {
  const slug = path
    .resolve(absPath)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '');
  return slug.startsWith('-') ? slug : `-${slug}`;
}

function sumTranscriptUsage(filePath) {
  const seen = new Set();
  const totals = {
    input: 0,
    cached_input: 0,
    cache_write_input: 0,
    output: 0,
  };

  let reportedCostUsd = null;

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (row.type === 'result' && row.total_cost_usd != null) {
      reportedCostUsd = Number(row.total_cost_usd);
    }

    if (row.type !== 'assistant') continue;
    const messageId = row.message?.id || row.uuid;
    if (!messageId || seen.has(messageId)) continue;
    seen.add(messageId);

    const usage = row.message?.usage;
    if (!usage) continue;

    totals.input += Number(usage.input_tokens) || 0;
    totals.cached_input += Number(usage.cache_read_input_tokens) || 0;
    totals.cache_write_input += Number(usage.cache_creation_input_tokens) || 0;
    totals.output += Number(usage.output_tokens) || 0;
  }

  if (totals.input + totals.cached_input + totals.cache_write_input + totals.output === 0) {
    return null;
  }

  return {
    tokens: normalizeClaudeUsage(totals),
    reportedCostUsd,
  };
}

function findLatestTranscript(harnessDir, runStartMs = null) {
  const projectDir = path.join(os.homedir(), '.claude', 'projects', claudeProjectSlug(harnessDir));
  if (!fs.existsSync(projectDir)) return null;

  const candidates = fs
    .readdirSync(projectDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(projectDir, name))
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .filter(({ mtimeMs }) => (runStartMs ? mtimeMs >= runStartMs - 5 * 60_000 : true))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.filePath || null;
}

export function collectClaudeTokens({ harnessDir, transcriptPath = null, runStartMs = null }) {
  const chosenPath = transcriptPath || findLatestTranscript(harnessDir, runStartMs);
  if (!chosenPath || !fs.existsSync(chosenPath)) {
    return {
      ok: false,
      reason: transcriptPath
        ? `Transcript not found: ${transcriptPath}`
        : `No Claude transcript found for ${path.resolve(harnessDir)}`,
    };
  }

  const parsed = sumTranscriptUsage(chosenPath);
  if (!parsed) {
    return { ok: false, reason: `No assistant usage in ${chosenPath}` };
  }

  return {
    ok: true,
    source: 'claude_transcript',
    transcript_path: chosenPath,
    tokens: parsed.tokens,
    reported_cost_usd: parsed.reportedCostUsd,
  };
}

/** Parse a captured `claude -p --output-format json` result file. */
export function collectClaudeFromJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const row = JSON.parse(text);
  if (row.type !== 'result' || !row.usage) {
    return { ok: false, reason: `No Claude result.usage in ${filePath}` };
  }

  const usage = row.usage;
  return {
    ok: true,
    source: 'claude_json',
    tokens: normalizeClaudeUsage({
      input: usage.input_tokens,
      cached_input: usage.cache_read_input_tokens,
      cache_write_input: usage.cache_creation_input_tokens,
      output: usage.output_tokens,
    }),
    reported_cost_usd: row.total_cost_usd != null ? Number(row.total_cost_usd) : null,
    duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
  };
}
