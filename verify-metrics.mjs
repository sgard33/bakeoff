#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const harnesses = process.argv.slice(2);
const requiredTokenFields = ['input', 'cached_input', 'cache_write_input', 'output', 'total'];
const validCostSources = new Set(['computed', 'reported', 'admin_api']);

if (harnesses.length === 0) {
  console.error('Usage: node verify-metrics.mjs <harness...>');
  process.exit(1);
}

for (const harness of harnesses) {
  const logPath = path.join(root, harness, 'bakeoff', 'prompts.jsonl');
  const lines = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean)
    : [];
  if (lines.length === 0) {
    throw new Error(`${harness}: no prompt metrics found`);
  }

  const turn = JSON.parse(lines.at(-1));
  if (!(turn.duration_ms > 0)) throw new Error(`${harness}: duration_ms must be positive`);
  if (!turn.tokens || !(turn.tokens.total > 0)) {
    throw new Error(`${harness}: total tokens must be positive`);
  }
  for (const field of requiredTokenFields) {
    if (!Number.isFinite(turn.tokens[field]) || turn.tokens[field] < 0) {
      throw new Error(`${harness}: invalid tokens.${field}`);
    }
  }
  if (!Number.isFinite(turn.cost_usd) || turn.cost_usd < 0) {
    throw new Error(`${harness}: invalid cost_usd`);
  }
  if (!validCostSources.has(turn.cost_source)) {
    throw new Error(`${harness}: invalid cost_source ${turn.cost_source}`);
  }
  if (!turn.token_source || turn.token_source === 'unavailable' || turn.collection_error) {
    throw new Error(`${harness}: token collection failed`);
  }

  console.log(
    `${harness}: ${turn.duration_ms}ms, ${turn.tokens.total} tokens, $${turn.cost_usd} (${turn.token_source})`
  );
}
