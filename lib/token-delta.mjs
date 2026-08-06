/** Zero token vector in bakeoff schema. */
export function emptyTokens() {
  return {
    input: 0,
    cached_input: 0,
    cache_write_input: 0,
    output: 0,
    reasoning_output: 0,
    total: 0,
    source: 'exact',
  };
}

/** Subtract prior cumulative usage from current (per-turn delta). */
export function subtractTokens(current, previous) {
  const prev = previous || emptyTokens();
  const input = Math.max(0, (current.input || 0) - (prev.input || 0));
  const cached_input = Math.max(0, (current.cached_input || 0) - (prev.cached_input || 0));
  const cache_write_input = Math.max(
    0,
    (current.cache_write_input || 0) - (prev.cache_write_input || 0)
  );
  const output = Math.max(0, (current.output || 0) - (prev.output || 0));
  const reasoning_output = Math.max(
    0,
    (current.reasoning_output || 0) - (prev.reasoning_output || 0)
  );
  const total =
    current.total != null && prev.total != null
      ? Math.max(0, current.total - prev.total)
      : input + cached_input + cache_write_input + output;

  return {
    input,
    cached_input,
    cache_write_input,
    output,
    reasoning_output,
    total,
    source: current.source || 'exact',
  };
}

/** Add token vectors for running totals. */
export function addTokens(a, b) {
  const left = a || emptyTokens();
  const right = b || emptyTokens();
  const input = (left.input || 0) + (right.input || 0);
  const cached_input = (left.cached_input || 0) + (right.cached_input || 0);
  const cache_write_input = (left.cache_write_input || 0) + (right.cache_write_input || 0);
  const output = (left.output || 0) + (right.output || 0);
  const reasoning_output = (left.reasoning_output || 0) + (right.reasoning_output || 0);
  const total =
    left.total != null || right.total != null
      ? (left.total || 0) + (right.total || 0)
      : input + cached_input + cache_write_input + output;

  return {
    input,
    cached_input,
    cache_write_input,
    output,
    reasoning_output,
    total,
    source: 'exact',
  };
}
