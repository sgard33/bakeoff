#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const currentDir = path.join(root, 'metrics', 'current');
const requiredTokenFields = ['input', 'cached_input', 'cache_write_input', 'output', 'total'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const hookFiles = [
  'cursor/.cursor/hooks.json',
  'claudecode/.claude/settings.json',
  'codex/.codex/hooks.json',
];
for (const relativePath of hookFiles) {
  const filePath = path.join(root, relativePath);
  assert(fs.existsSync(filePath), `Missing ${relativePath}`);
  readJson(filePath);
}

const scripts = [
  'cursor/.cursor/hooks/start.sh',
  'cursor/.cursor/hooks/stop.sh',
  'claudecode/.claude/hooks/stamp-start.sh',
  'claudecode/.claude/hooks/collect-tokens.sh',
  'codex/.codex/hooks/stamp-start.sh',
  'codex/.codex/hooks/collect-tokens.sh',
];
for (const relativePath of scripts) {
  const filePath = path.join(root, relativePath);
  assert(fs.existsSync(filePath), `Missing ${relativePath}`);
  assert((fs.statSync(filePath).mode & 0o111) !== 0, `${relativePath} is not executable`);
}
console.log('Hook configuration: valid');

const envPath = path.join(root, '.env');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
assert(/^CURSOR_ADMIN_API_KEY=.+$/m.test(envText), 'Missing CURSOR_ADMIN_API_KEY in .env');
const hasAdminEmail = /^CURSOR_ADMIN_EMAIL=.+$/m.test(envText);
const gitEmail = spawnSync('git', ['config', 'user.email'], { cwd: root, encoding: 'utf8' })
  .stdout?.trim();
assert(hasAdminEmail || gitEmail, 'Missing CURSOR_ADMIN_EMAIL and git user.email fallback');
console.log('Cursor Admin API configuration: present');

const racePath = path.join(currentDir, 'race.json');
if (!fs.existsSync(racePath)) {
  console.log('No active race; hook setup only was verified.');
  process.exit(0);
}

const race = readJson(racePath);
for (const harness of race.pair) {
  for (const phase of ['plan', 'build']) {
    const filePath = path.join(currentDir, harness, `${phase}.json`);
    assert(fs.existsSync(filePath), `${harness} ${phase}: missing`);
    const turn = readJson(filePath);
    assert(turn.status === 'complete', `${harness} ${phase}: status is ${turn.status}`);
    assert(turn.duration_ms > 0, `${harness} ${phase}: duration must be positive`);
    for (const field of requiredTokenFields) {
      assert(
        Number.isFinite(turn.tokens?.[field]) && turn.tokens[field] >= 0,
        `${harness} ${phase}: invalid tokens.${field}`
      );
    }
    assert(turn.tokens.total > 0, `${harness} ${phase}: total tokens must be positive`);
    assert(
      Number.isFinite(turn.cost_usd) && turn.cost_usd >= 0,
      `${harness} ${phase}: list cost is unavailable`
    );
    assert(turn.token_source, `${harness} ${phase}: missing token source`);
    console.log(
      `${harness} ${phase}: ${turn.duration_ms}ms, ${turn.tokens.total} tokens, $${turn.cost_usd}`
    );
  }
}
