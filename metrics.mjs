#!/usr/bin/env node
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const metricsDir = path.join(root, 'metrics');
const currentDir = path.join(metricsDir, 'current');
const historyDir = path.join(metricsDir, 'history');
const reportPath = path.join(metricsDir, 'report.html');
const harnesses = new Set(['cursor', 'claudecode', 'codex']);
const phases = ['plan', 'build'];

const args = process.argv.slice(2);
const command = args[0];

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] != null) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function appendEvent(event) {
  fs.mkdirSync(currentDir, { recursive: true });
  fs.appendFileSync(
    path.join(currentDir, 'events.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`
  );
}

function racePath() {
  return path.join(currentDir, 'race.json');
}

function activePath(harness) {
  return path.join(currentDir, harness, 'active.json');
}

function turnPath(harness, phase) {
  return path.join(currentDir, harness, `${phase}.json`);
}

function getRace() {
  return readJson(racePath());
}

function requireHarness(value) {
  if (!harnesses.has(value)) {
    throw new Error(`Unknown harness "${value}". Expected cursor, claudecode, or codex.`);
  }
  return value;
}

function phaseForNextTurn(harness) {
  // A phase is available if it was never recorded or its last attempt errored,
  // so a failed turn can be retried simply by prompting again.
  return (
    phases.find((phase) => {
      const turn = readJson(turnPath(harness, phase));
      return !turn || turn.status === 'error';
    }) || null
  );
}

function emptyTokens() {
  return {
    input: 0,
    cached_input: 0,
    cache_write_input: 0,
    output: 0,
    reasoning_output: 0,
    total: 0,
  };
}

function sumTokens(rows) {
  const total = emptyTokens();
  for (const row of rows) {
    for (const key of Object.keys(total)) total[key] += Number(row?.[key]) || 0;
  }
  return total;
}

function normalizeClaudeUsage(usage) {
  const tokens = {
    input: Number(usage?.input_tokens) || 0,
    cached_input: Number(usage?.cache_read_input_tokens) || 0,
    cache_write_input: Number(usage?.cache_creation_input_tokens) || 0,
    output: Number(usage?.output_tokens) || 0,
    reasoning_output: 0,
  };
  tokens.total =
    tokens.input + tokens.cached_input + tokens.cache_write_input + tokens.output;
  return tokens;
}

function normalizeCodexUsage(usage) {
  const cached = Number(usage?.cached_input_tokens) || 0;
  const inputTotal = Number(usage?.input_tokens) || 0;
  const tokens = {
    input: Math.max(0, inputTotal - cached),
    cached_input: cached,
    cache_write_input: Number(usage?.cache_write_input_tokens) || 0,
    output: Number(usage?.output_tokens) || 0,
    reasoning_output: Number(usage?.reasoning_output_tokens) || 0,
  };
  tokens.total =
    Number(usage?.total_tokens) ||
    tokens.input + tokens.cached_input + tokens.cache_write_input + tokens.output;
  return tokens;
}

function normalizeCursorUsage(rows) {
  return sumTokens(
    rows.map((row) => {
      const usage = row.tokenUsage || {};
      const tokens = {
        input: Number(usage.inputTokens) || 0,
        cached_input: Number(usage.cacheReadTokens) || 0,
        cache_write_input: Number(usage.cacheWriteTokens) || 0,
        output: Number(usage.outputTokens) || 0,
        reasoning_output: 0,
      };
      tokens.total =
        tokens.input + tokens.cached_input + tokens.cache_write_input + tokens.output;
      return tokens;
    })
  );
}

const pricingProfiles = [
  {
    pattern: /claude-opus-5/i,
    name: 'Claude Opus 5 list pricing',
    rates: { input: 5, cached_input: 0.5, cache_write_input: 6.25, output: 25 },
  },
  {
    pattern: /claude-opus-4/i,
    name: 'Claude Opus 4 list pricing',
    rates: { input: 15, cached_input: 1.5, cache_write_input: 18.75, output: 75 },
  },
];

function computedCost(items) {
  let micros = 0;
  const profiles = new Set();
  for (const item of items) {
    const profile = pricingProfiles.find((candidate) => candidate.pattern.test(item.model || ''));
    if (!profile) {
      return {
        cost_usd: null,
        cost_source: 'unavailable',
        cost_note: `No list-price profile for ${item.model || 'unknown model'}`,
      };
    }
    profiles.add(profile.name);
    const tokens = item.tokens;
    micros +=
      tokens.input * profile.rates.input +
      tokens.cached_input * profile.rates.cached_input +
      tokens.cache_write_input * profile.rates.cache_write_input +
      tokens.output * profile.rates.output;
  }
  return {
    cost_usd: Math.round((micros / 1_000_000) * 1_000_000) / 1_000_000,
    cost_source: 'computed_list',
    cost_note: [...profiles].join(', '),
  };
}

function parseTime(value) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function withinWindow(timestamp, startedAtMs, endedAtMs, bufferMs = 2000) {
  const value = parseTime(timestamp);
  return value != null && value >= startedAtMs - bufferMs && value <= endedAtMs + bufferMs;
}

function claudeTranscriptCandidates(explicitPath, harnessDir) {
  if (explicitPath && fs.existsSync(explicitPath)) return [explicitPath];
  // Claude sanitizes the project cwd into its folder name by replacing every
  // non-alphanumeric character (slashes, dots, etc.) with a dash.
  const slug = harnessDir.replace(/[^a-zA-Z0-9]/g, '-');
  const dir = path.join(os.homedir(), '.claude', 'projects', slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name));
}

function collectClaude(active, endedAtMs, transcriptPath) {
  const harnessDir = path.join(root, 'claudecode');
  const candidates = claudeTranscriptCandidates(transcriptPath, harnessDir);
  if (candidates.length === 0) throw new Error('Claude transcript not found');

  const seen = new Set();
  const items = [];
  const matchedFiles = new Set();
  for (const filePath of candidates) {
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const message = row.message;
      const messageId = message?.id;
      if (
        row.type !== 'assistant' ||
        row.isSidechain === true ||
        !messageId ||
        seen.has(messageId) ||
        !message?.usage ||
        !withinWindow(row.timestamp, active.started_at_ms, endedAtMs)
      ) {
        continue;
      }
      seen.add(messageId);
      matchedFiles.add(path.basename(filePath));
      items.push({
        model: message.model || 'unknown',
        tokens: normalizeClaudeUsage(message.usage),
      });
    }
  }
  if (items.length === 0) {
    throw new Error('No Claude usage found for this turn in the transcript window');
  }
  return {
    tokens: sumTokens(items.map((item) => item.tokens)),
    models: [...new Set(items.map((item) => item.model))],
    token_source: 'claude_transcript',
    source_detail: [...matchedFiles].join(', '),
    ...computedCost(items),
  };
}

function codexRollouts() {
  const sessionsDir = path.join(os.homedir(), '.codex', 'sessions');
  if (!fs.existsSync(sessionsDir)) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
        files.push(filePath);
      }
    }
  };
  walk(sessionsDir);
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function collectCodex(active, endedAtMs) {
  const expectedCwd = path.join(root, 'codex');
  let chosen = null;
  for (const filePath of codexRollouts()) {
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n', 1)[0];
    try {
      const meta = JSON.parse(firstLine);
      if (meta.type === 'session_meta' && meta.payload?.cwd === expectedCwd) {
        chosen = filePath;
        break;
      }
    } catch {
      // Ignore malformed or unrelated rollouts.
    }
  }
  if (!chosen) throw new Error('Codex rollout not found');

  let usage = null;
  let model = null;
  for (const line of fs.readFileSync(chosen, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!withinWindow(row.timestamp, active.started_at_ms, endedAtMs, 3000)) continue;
    if (row.type === 'turn_context' && row.payload?.model) model = row.payload.model;
    if (row.type === 'event_msg' && row.payload?.type === 'token_count') {
      usage = row.payload.info?.last_token_usage || usage;
    }
  }
  if (!usage) throw new Error(`No Codex usage found for this turn in ${chosen}`);
  const tokens = normalizeCodexUsage(usage);
  const item = { model: model || 'unknown', tokens };
  return {
    tokens,
    models: [item.model],
    token_source: 'codex_rollout',
    source_detail: path.basename(chosen),
    ...computedCost([item]),
  };
}

async function fetchCursorEvents(startMs, endMs) {
  loadEnv();
  const apiKey = process.env.CURSOR_ADMIN_API_KEY;
  const gitEmail = spawnSync('git', ['config', 'user.email'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout?.trim();
  const email = process.env.CURSOR_ADMIN_EMAIL || gitEmail;
  if (!apiKey) throw new Error('CURSOR_ADMIN_API_KEY is not set in .env');
  if (!email) {
    throw new Error(
      'CURSOR_ADMIN_EMAIL is not set and git user.email is unavailable; refusing team-wide usage'
    );
  }

  const authorization = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  const events = [];
  let cursor;
  do {
    const body = {
      startDate: Math.max(0, startMs - 3000),
      endDate: endMs + 5000,
      email,
      pageSize: 100,
    };
    if (cursor) body.cursor = cursor;
    const response = await fetch('https://api.cursor.com/teams/filtered-usage-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Cursor Admin API ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const payload = await response.json();
    events.push(...(payload.usageEvents || payload.events || []));
    const hasNext = payload.pagination?.hasNextPage ?? payload.hasNextPage ?? false;
    cursor = payload.pagination?.nextCursor ?? payload.nextCursor;
    if (!hasNext) cursor = null;
  } while (cursor);

  return events.filter((event) => {
    const timestamp = Number(event.timestamp);
    return (
      event.tokenUsage &&
      Number.isFinite(timestamp) &&
      timestamp >= startMs - 3000 &&
      timestamp <= endMs + 5000
    );
  });
}

function cursorFingerprint(events) {
  return events
    .map((event) => [
      event.timestamp,
      event.model,
      event.tokenUsage?.inputTokens,
      event.tokenUsage?.outputTokens,
      event.tokenUsage?.cacheReadTokens,
      event.tokenUsage?.cacheWriteTokens,
      event.tokenUsage?.totalCents,
    ])
    .sort()
    .join('|');
}

async function collectCursor(phase, raceId) {
  const filePath = turnPath('cursor', phase);
  const turn = readJson(filePath);
  const race = getRace();
  if (!turn || !race || turn.race_id !== raceId || race.id !== raceId) return;

  const pollMs = Number(process.env.METRICS_CURSOR_POLL_MS) || 5000;
  const timeoutMs = Number(process.env.METRICS_CURSOR_TIMEOUT_MS) || 90000;
  const deadline = Date.now() + timeoutMs;
  let lastFingerprint = null;
  let stablePolls = 0;
  let events = [];

  try {
    while (Date.now() < deadline) {
      const next = await fetchCursorEvents(turn.started_at_ms, turn.ended_at_ms);
      const fingerprint = cursorFingerprint(next);
      if (next.length > 0 && fingerprint === lastFingerprint) stablePolls += 1;
      else stablePolls = 0;
      events = next;
      lastFingerprint = fingerprint;
      if (events.length > 0 && stablePolls >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    if (events.length === 0) throw new Error('No Cursor usage events appeared before timeout');

    const listCostCents = events.reduce(
      (sum, event) => sum + (Number(event.tokenUsage?.totalCents) || 0),
      0
    );
    const billedCostCents = events.reduce(
      (sum, event) => sum + (Number(event.chargedCents) || 0),
      0
    );
    const updated = {
      ...turn,
      status: 'complete',
      tokens: normalizeCursorUsage(events),
      models: [...new Set(events.map((event) => event.model).filter(Boolean))],
      token_source: 'cursor_admin_api',
      cost_usd: Math.round(listCostCents * 10000) / 1_000_000,
      cost_source: 'admin_api_list',
      cost_note: 'Undiscounted list price from tokenUsage.totalCents',
      billed_cost_usd: Math.round(billedCostCents * 10000) / 1_000_000,
      event_count: events.length,
    };
    if (getRace()?.id !== raceId) return;
    writeJson(filePath, updated);
    appendEvent({ event: 'cursor_collected', phase, event_count: events.length });
  } catch (error) {
    if (getRace()?.id !== raceId) return;
    writeJson(filePath, {
      ...turn,
      status: 'error',
      collection_error: error.message,
    });
    appendEvent({ event: 'cursor_collection_failed', phase, error: error.message });
  }
  renderReport();
}

function startRace(pair) {
  if (pair.length !== 2) throw new Error('Usage: npm run race -- cursor <claudecode|codex>');
  pair.forEach(requireHarness);
  if (!pair.includes('cursor') || pair.includes('claudecode') === pair.includes('codex')) {
    throw new Error('A race must be cursor vs claudecode, or cursor vs codex');
  }
  if (getRace() && phases.some((phase) => pair.some((harness) => readJson(turnPath(harness, phase))))) {
    throw new Error('Current race already has results. Run npm run reset before starting another.');
  }
  const race = {
    id: crypto.randomUUID(),
    pair,
    started_at: new Date().toISOString(),
  };
  writeJson(racePath(), race);
  appendEvent({ event: 'race_started', pair });
  renderReport();
  console.log(`Race ready: ${pair.join(' vs ')}`);
}

function startTurn(harness) {
  requireHarness(harness);
  const race = getRace();
  if (!race?.pair?.includes(harness)) {
    console.error(`Metrics skipped: ${harness} is not in the active race`);
    return;
  }
  const phase = phaseForNextTurn(harness);
  if (!phase) {
    console.error(`Metrics skipped: ${harness} already completed plan and build`);
    return;
  }
  const active = {
    race_id: race.id,
    harness,
    phase,
    started_at: new Date().toISOString(),
    started_at_ms: Date.now(),
  };
  writeJson(activePath(harness), active);
  appendEvent({ event: 'turn_started', harness, phase });
  console.error(`[metrics] ${harness} ${phase} started`);
}

function readFlag(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function stopTurn(harness) {
  requireHarness(harness);
  const activeFile = activePath(harness);
  const active = readJson(activeFile);
  const race = getRace();
  if (!active || !race || active.race_id !== race.id) {
    console.error(`Metrics skipped: no active ${harness} turn`);
    return;
  }

  const endedAtMs = Date.now();
  const base = {
    race_id: race.id,
    harness,
    phase: active.phase,
    status: harness === 'cursor' ? 'pending' : 'complete',
    started_at: active.started_at,
    started_at_ms: active.started_at_ms,
    ended_at: new Date(endedAtMs).toISOString(),
    ended_at_ms: endedAtMs,
    duration_ms: Math.max(0, endedAtMs - active.started_at_ms),
  };

  try {
    let completed = base;
    if (harness === 'claudecode') {
      completed = {
        ...base,
        ...collectClaude(active, endedAtMs, readFlag('--transcript')),
      };
    } else if (harness === 'codex') {
      completed = { ...base, ...collectCodex(active, endedAtMs) };
    }
    writeJson(turnPath(harness, active.phase), completed);
    fs.unlinkSync(activeFile);
    appendEvent({ event: 'turn_stopped', harness, phase: active.phase });
    renderReport();

    if (harness === 'cursor') {
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), 'collect-cursor', active.phase, race.id],
        { cwd: root, detached: true, stdio: 'ignore' }
      );
      child.unref();
      console.error(`[metrics] cursor ${active.phase} complete; dashboard data pending`);
    } else {
      console.error(`[metrics] ${harness} ${active.phase} captured`);
    }
  } catch (error) {
    writeJson(turnPath(harness, active.phase), {
      ...base,
      status: 'error',
      collection_error: error.message,
    });
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
    appendEvent({ event: 'turn_failed', harness, phase: active.phase, error: error.message });
    renderReport();
    console.error(`[metrics] ${harness} ${active.phase} failed: ${error.message}`);
  }
}

function setCost(harness, phase, amount) {
  requireHarness(harness);
  if (!phases.includes(phase) || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
    throw new Error('Usage: npm run set-cost -- <harness> <plan|build> <usd>');
  }
  const filePath = turnPath(harness, phase);
  const turn = readJson(filePath);
  if (!turn) throw new Error(`No ${harness} ${phase} turn found`);
  writeJson(filePath, {
    ...turn,
    cost_usd: Number(amount),
    cost_source: 'manual_reported',
    cost_note: 'Manually entered from CLI /usage',
  });
  appendEvent({ event: 'cost_overridden', harness, phase });
  renderReport();
  console.log(`Updated ${harness} ${phase} cost to $${Number(amount).toFixed(4)}`);
}

function archiveCurrent() {
  fs.mkdirSync(historyDir, { recursive: true });
  const race = getRace();
  const hasCurrent = fs.existsSync(currentDir) && fs.readdirSync(currentDir).length > 0;
  if (hasCurrent && race) {
    renderReport();
    const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
    const pair = race.pair.join('-vs-');
    const destination = path.join(historyDir, `${stamp}-${pair}`);
    fs.cpSync(currentDir, destination, { recursive: true });
    if (fs.existsSync(reportPath)) fs.copyFileSync(reportPath, path.join(destination, 'report.html'));
    console.log(`Archived metrics to ${path.relative(root, destination)}`);
  }
  fs.rmSync(currentDir, { recursive: true, force: true });
  renderReport();
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDuration(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return '—';
  const seconds = Number(ms) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatCost(value) {
  return value != null && Number.isFinite(Number(value)) ? `$${Number(value).toFixed(4)}` : '—';
}

function displayName(harness) {
  return { cursor: 'Cursor', claudecode: 'Claude Code', codex: 'Codex' }[harness] || harness;
}

function totalForHarness(harness) {
  const turns = phases.map((phase) => readJson(turnPath(harness, phase))).filter(Boolean);
  const complete = turns.filter((turn) => turn.status === 'complete');
  return {
    status: turns.length === 2 && complete.length === 2 ? 'complete' : 'pending',
    tokens: sumTokens(complete.map((turn) => turn.tokens)),
    duration_ms: turns.reduce((sum, turn) => sum + (Number(turn.duration_ms) || 0), 0),
    cost_usd:
      complete.length > 0 &&
      complete.every(
        (turn) => turn.cost_usd != null && Number.isFinite(Number(turn.cost_usd))
      )
        ? complete.reduce((sum, turn) => sum + Number(turn.cost_usd), 0)
        : null,
  };
}

function metricCell(turn, field, formatter = formatInteger) {
  if (!turn) return '<td class="empty">Waiting</td>';
  if (turn.status === 'pending') return '<td class="pending">Syncing dashboard…</td>';
  if (turn.status === 'error') {
    return `<td class="error" title="${escapeHtml(turn.collection_error || 'Collection failed')}">Error</td>`;
  }
  return `<td>${formatter(field(turn))}</td>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function comparisonTable(pair, phase) {
  const turns = Object.fromEntries(pair.map((harness) => [harness, readJson(turnPath(harness, phase))]));
  const rows = [
    ['Input', (turn) => turn.tokens?.input],
    ['Cache read', (turn) => turn.tokens?.cached_input],
    ['Cache write', (turn) => turn.tokens?.cache_write_input],
    ['Output', (turn) => turn.tokens?.output],
    ['Total tokens', (turn) => turn.tokens?.total],
    ['Time', (turn) => turn.duration_ms, formatDuration],
    ['List cost', (turn) => turn.cost_usd, formatCost],
  ];
  return `
    <section class="phase-card">
      <div class="phase-heading">
        <span class="phase-number">${phase === 'plan' ? '01' : '02'}</span>
        <div><p class="eyebrow">${phase}</p><h2>${phase === 'plan' ? 'Plan the work' : 'Build the page'}</h2></div>
      </div>
      <table>
        <thead><tr><th>Metric</th>${pair.map((h) => `<th>${displayName(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              ([label, field, formatter]) =>
                `<tr><th>${label}</th>${pair
                  .map((harness) => metricCell(turns[harness], field, formatter))
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="turn-notes">
        ${pair
          .map((harness) => {
            const turn = turns[harness];
            if (!turn) return `<span>${displayName(harness)}: waiting for ${phase}</span>`;
            if (turn.status === 'error') {
              return `<span class="error-text">${displayName(harness)}: ${escapeHtml(turn.collection_error)}</span>`;
            }
            const models = turn.models?.join(', ') || 'model pending';
            const source = turn.cost_source || 'cost pending';
            const events = turn.event_count ? ` · ${turn.event_count} API events` : '';
            return `<span>${displayName(harness)}: ${escapeHtml(models)} · ${escapeHtml(source)}${events}</span>`;
          })
          .join('')}
      </div>
    </section>`;
}

function totalsSection(pair) {
  const totals = Object.fromEntries(pair.map((harness) => [harness, totalForHarness(harness)]));
  return `
    <section class="totals">
      <div><p class="eyebrow">Combined</p><h2>Plan + build totals</h2></div>
      <div class="total-grid">
        ${pair
          .map((harness) => {
            const total = totals[harness];
            return `<article>
              <h3>${displayName(harness)}</h3>
              <div class="big-number">${formatCost(total.cost_usd)}</div>
              <p>undiscounted list cost</p>
              <dl>
                <div><dt>Total time</dt><dd>${formatDuration(total.duration_ms)}</dd></div>
                <div><dt>Input</dt><dd>${formatInteger(total.tokens.input)}</dd></div>
                <div><dt>Cache read</dt><dd>${formatInteger(total.tokens.cached_input)}</dd></div>
                <div><dt>Cache write</dt><dd>${formatInteger(total.tokens.cache_write_input)}</dd></div>
                <div><dt>Output</dt><dd>${formatInteger(total.tokens.output)}</dd></div>
                <div><dt>Total tokens</dt><dd>${formatInteger(total.tokens.total)}</dd></div>
              </dl>
            </article>`;
          })
          .join('')}
      </div>
    </section>`;
}

function renderReport() {
  fs.mkdirSync(metricsDir, { recursive: true });
  const race = getRace();
  const pair = race?.pair || [];
  const content =
    pair.length === 2
      ? `${comparisonTable(pair, 'plan')}${comparisonTable(pair, 'build')}${totalsSection(pair)}`
      : `<section class="empty-state"><p class="eyebrow">Ready</p><h2>No active race</h2><p>Run <code>npm run race -- cursor claudecode</code> or replace <code>claudecode</code> with <code>codex</code>.</p></section>`;
  const title = pair.length === 2 ? pair.map(displayName).join(' vs ') : 'Bakeoff metrics';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="8">
  <title>${escapeHtml(title)} — Bakeoff</title>
  <style>
    :root { color-scheme: light; --bg:#f7f7f4; --fg:#26251e; --accent:#f54e00; --card:#f0efeb; --line:#d8d6cf; --muted:rgba(38,37,30,.6); }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
    main { width:min(1180px,calc(100% - 32px)); margin:0 auto; padding:64px 0 80px; }
    header { display:flex; justify-content:space-between; align-items:flex-end; gap:32px; margin-bottom:48px; border-bottom:1px solid var(--line); padding-bottom:28px; }
    h1,h2,h3,p { margin:0; }
    h1 { font:500 clamp(36px,6vw,72px)/.95 system-ui,sans-serif; letter-spacing:-.055em; max-width:780px; }
    h2 { font:550 28px/1.1 system-ui,sans-serif; letter-spacing:-.035em; }
    h3 { font:550 20px/1.2 system-ui,sans-serif; }
    .eyebrow { color:var(--accent); text-transform:uppercase; font-size:12px; letter-spacing:.12em; margin-bottom:7px; }
    .status { text-align:right; color:var(--muted); white-space:nowrap; }
    .status i { display:inline-block; width:8px; height:8px; border-radius:50%; background:#2b9a66; margin-right:8px; }
    .phase-card { background:var(--card); border-radius:14px; overflow:hidden; margin-bottom:20px; }
    .phase-heading { display:flex; gap:18px; align-items:center; padding:26px 28px 20px; }
    .phase-number { color:var(--muted); font-size:13px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:var(--bg); }
    th,td { padding:15px 20px; border-top:1px solid var(--line); text-align:right; }
    th:first-child { text-align:left; color:var(--muted); font-weight:400; }
    thead th { color:var(--fg); font-weight:600; }
    td { font-size:16px; font-variant-numeric:tabular-nums; }
    .empty,.pending { color:var(--muted); font-size:13px; }
    .pending { color:var(--accent); }
    .error,.error-text { color:#b42318; }
    .turn-notes { display:flex; justify-content:space-between; gap:20px; padding:15px 20px; color:var(--muted); font-size:11px; }
    .totals { margin-top:52px; }
    .total-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-top:20px; }
    .total-grid article { background:var(--fg); color:var(--bg); border-radius:14px; padding:28px; }
    .big-number { color:#ff6a26; font:500 clamp(42px,6vw,72px)/1 system-ui,sans-serif; letter-spacing:-.05em; margin-top:34px; }
    .total-grid article > p { color:rgba(247,247,244,.55); margin:4px 0 26px; }
    dl { margin:0; border-top:1px solid rgba(247,247,244,.2); }
    dl div { display:flex; justify-content:space-between; padding:11px 0; border-bottom:1px solid rgba(247,247,244,.12); }
    dt { color:rgba(247,247,244,.58); }
    dd { margin:0; font-variant-numeric:tabular-nums; }
    .empty-state { padding:72px 28px; background:var(--card); border-radius:14px; }
    .empty-state p:last-child { margin-top:14px; color:var(--muted); }
    code { background:#e6e5e0; padding:2px 5px; border-radius:4px; }
    footer { color:var(--muted); margin-top:30px; font-size:11px; display:flex; justify-content:space-between; }
    @media (max-width:720px) {
      main { padding-top:32px; } header { display:block; } .status { text-align:left; margin-top:18px; }
      .total-grid { grid-template-columns:1fr; } th,td { padding:12px 9px; font-size:12px; }
      .turn-notes { display:block; } .turn-notes span { display:block; margin-top:5px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div><p class="eyebrow">Two-turn CLI bakeoff</p><h1>${escapeHtml(title)}</h1></div>
      <p class="status"><i></i>${race ? `Race ${escapeHtml(race.id.slice(0, 8))}` : 'Waiting for setup'}<br>auto-refreshes every 8s</p>
    </header>
    ${content}
    <footer><span>Headline cost uses undiscounted list pricing.</span><span>Generated ${new Date().toLocaleString('en-US')}</span></footer>
  </main>
</body>
</html>`;
  fs.writeFileSync(reportPath, html);
}

async function main() {
  if (command === 'race') return startRace(args.slice(1));
  if (command === 'start') return startTurn(args[1]);
  if (command === 'stop') return stopTurn(args[1]);
  if (command === 'collect-cursor') return collectCursor(args[1], args[2]);
  if (command === 'set-cost') return setCost(args[1], args[2], args[3]);
  if (command === 'archive') return archiveCurrent();
  if (command === 'report') return renderReport();
  throw new Error(
    'Usage: node metrics.mjs <race|start|stop|collect-cursor|set-cost|archive|report> ...'
  );
}

main().catch((error) => {
  console.error(`metrics failed: ${error.message}`);
  process.exit(1);
});
