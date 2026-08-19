#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const harnesses = ['cursor', 'claudecode', 'codex', 'copilot'];

const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing - Starter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="container">
    <h1>Pricing</h1>
    <p class="subtitle">Update this page to match the task in PROMPT.md. Search the project for pricing content, brand tokens, and component patterns.</p>
  </main>
</body>
</html>
`;

const starterCss = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f5f7f6;
  color: #1c2421;
  line-height: 1.5;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem;
}

.subtitle {
  margin-top: 0.5rem;
  opacity: 0.7;
}
`;

// Keep all harnesses aligned with the shared marketing kit.
const sync = spawnSync(process.execPath, ['sync-shared.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (sync.stdout) process.stdout.write(sync.stdout);
if (sync.stderr) process.stderr.write(sync.stderr);
if (sync.status !== 0) {
  console.error('Failed to sync shared/ into harness folders');
  process.exit(1);
}

for (const harness of harnesses) {
  const dir = path.join(root, harness);
  fs.writeFileSync(path.join(dir, 'index.html'), starterHtml);
  fs.writeFileSync(path.join(dir, 'style.css'), starterCss);
}

console.log('Bakeoff demo reset.');
console.log('- Synced shared/ marketing kit into cursor/, claudecode/, codex/, and copilot/');
console.log('- Restored starter index.html and style.css');
