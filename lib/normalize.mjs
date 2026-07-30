/** Normalize Codex cumulative usage into the bakeoff schema. */
export function normalizeCodexUsage(raw) {
  const inputTotal = Number(raw.input_tokens) || 0;
  const cached = Number(raw.cached_input_tokens) || 0;
  const cacheWrite = Number(raw.cache_write_input_tokens) || 0;
  const output = Number(raw.output_tokens) || 0;
  const reasoning = Number(raw.reasoning_output_tokens) || 0;
  const uncached = Math.max(0, inputTotal - cached);

  const total =
    Number(raw.total_tokens) ||
    inputTotal + output + cacheWrite;

  return {
    input: uncached,
    cached_input: cached,
    cache_write_input: cacheWrite,
    output,
    reasoning_output: reasoning,
    total,
    source: 'exact',
  };
}

/** Normalize summed Claude transcript usage. */
export function normalizeClaudeUsage(totals) {
  const input = Number(totals.input) || 0;
  const cached = Number(totals.cached_input) || 0;
  const cacheWrite = Number(totals.cache_write_input) || 0;
  const output = Number(totals.output) || 0;

  return {
    input,
    cached_input: cached,
    cache_write_input: cacheWrite,
    output,
    reasoning_output: 0,
    total: input + cached + cacheWrite + output,
    source: 'exact',
  };
}

/** Normalize Cursor stream-json `usage` object. */
export function normalizeCursorUsage(usage) {
  const input = Number(usage.inputTokens) || 0;
  const cached = Number(usage.cacheReadTokens) || 0;
  const cacheWrite = Number(usage.cacheWriteTokens) || 0;
  const output = Number(usage.outputTokens) || 0;

  return {
    input,
    cached_input: cached,
    cache_write_input: cacheWrite,
    output,
    reasoning_output: 0,
    total: input + cached + cacheWrite + output,
    source: 'exact',
  };
}

/** Normalize summed Admin API tokenUsage rows. */
export function normalizeCursorAdminUsage(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.input += Number(row.inputTokens) || 0;
      acc.cached_input += Number(row.cacheReadTokens) || 0;
      acc.cache_write_input += Number(row.cacheWriteTokens) || 0;
      acc.output += Number(row.outputTokens) || 0;
      return acc;
    },
    { input: 0, cached_input: 0, cache_write_input: 0, output: 0 }
  );

  return {
    ...normalizeClaudeUsage({
      input: totals.input,
      cached_input: totals.cached_input,
      cache_write_input: totals.cache_write_input,
      output: totals.output,
    }),
    source: 'exact',
  };
}
