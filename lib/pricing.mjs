/**
 * Approximate $/MTok rates for computed cost when a tool does not report dollars.
 * These are ballpark defaults for demo comparisons, not billing truth.
 */
const PROFILES = {
  codex: {
    input: 2.5,
    cached_input: 0.25,
    cache_write_input: 0,
    output: 10,
    reasoning_output: 10,
  },
  claudecode: {
    input: 15,
    cached_input: 1.5,
    cache_write_input: 18.75,
    output: 75,
    reasoning_output: 0,
  },
  cursor: {
    input: 3,
    cached_input: 0.3,
    cache_write_input: 3.75,
    output: 15,
    reasoning_output: 0,
  },
  copilot: {
    input: 3,
    cached_input: 0.3,
    cache_write_input: 3.75,
    output: 15,
    reasoning_output: 0,
  },
};

export function computeCostUsd(tokens, harness) {
  const rates = PROFILES[harness] || PROFILES.cursor;
  const visibleOutput = Math.max(0, (tokens.output || 0) - (tokens.reasoning_output || 0));

  const micros =
    (tokens.input || 0) * rates.input +
    (tokens.cached_input || 0) * rates.cached_input +
    (tokens.cache_write_input || 0) * rates.cache_write_input +
    visibleOutput * rates.output +
    (tokens.reasoning_output || 0) * rates.reasoning_output;

  return Math.round((micros / 1_000_000) * 1_000_000) / 1_000_000;
}
