import fs from 'fs';
import { normalizeCursorAdminUsage, normalizeCursorUsage } from '../normalize.mjs';

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function collectCursorFromStreamJson(filePath) {
  const lines = readJsonLines(filePath);
  let lastResult = null;
  for (const row of lines) {
    if (row.type === 'result') lastResult = row;
  }

  if (!lastResult?.usage) {
    return { ok: false, reason: `No result.usage in ${filePath}` };
  }

  return {
    ok: true,
    source: 'cursor_stream_json',
    tokens: normalizeCursorUsage(lastResult.usage),
    raw: lastResult.usage,
  };
}

function eventCostCents(event) {
  if (event.chargedCents != null) return Number(event.chargedCents) || 0;
  if (event.tokenUsage?.totalCents != null) return Number(event.tokenUsage.totalCents) || 0;
  return 0;
}

export async function collectCursorFromAdminApi({
  startMs,
  endMs,
  email = null,
  headlessOnly = false,
}) {
  const apiKey = process.env.CURSOR_ADMIN_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'CURSOR_ADMIN_API_KEY is not set' };
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const events = [];
  let cursor = undefined;

  while (true) {
    const body = {
      startDate: startMs,
      endDate: endMs,
      pageSize: 100,
    };
    if (email) body.email = email;
    if (cursor) body.cursor = cursor;

    const response = await fetch('https://api.cursor.com/teams/filtered-usage-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        reason: `Cursor Admin API ${response.status}: ${detail.slice(0, 300)}`,
      };
    }

    const payload = await response.json();
    const pageEvents = payload.usageEvents || payload.events || [];
    events.push(...pageEvents);

    const hasNext = payload.pagination?.hasNextPage ?? payload.hasNextPage ?? false;
    cursor = payload.pagination?.nextCursor ?? payload.nextCursor;
    if (!hasNext || !cursor) break;
  }

  const filtered = events.filter((event) => {
    if (!headlessOnly) return true;
    return event.isHeadless === true;
  });

  const tokenRows = filtered
    .map((event) => event.tokenUsage)
    .filter((usage) => usage && eventHasTokens(usage));

  if (tokenRows.length === 0) {
    return {
      ok: false,
      reason: 'No token-based Cursor Admin API events in the selected window',
    };
  }

  const costCents = filtered.reduce((sum, event) => sum + eventCostCents(event), 0);

  return {
    ok: true,
    source: 'cursor_admin_api',
    tokens: normalizeCursorAdminUsage(tokenRows),
    cost_usd: Math.round(costCents) / 100,
    event_count: filtered.length,
  };
}

function eventHasTokens(usage) {
  return (
    (Number(usage.inputTokens) || 0) +
      (Number(usage.outputTokens) || 0) +
      (Number(usage.cacheReadTokens) || 0) +
      (Number(usage.cacheWriteTokens) || 0) >
    0
  );
}
