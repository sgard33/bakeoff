#!/usr/bin/env node
/**
 * Copy shared/ marketing kit into each harness folder so each tool
 * can search project conventions without leaving its workspace root.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.join(root, 'shared');
const harnesses = ['cursor', 'claudecode', 'codex', 'copilot'];

const DEST_DIRS = [
  'tokens',
  'content',
  'components',
  'docs',
  'reference',
  'styles',
];

const DROPPED_DIRS = ['blog', 'dashboard'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

if (!fs.existsSync(sharedRoot)) {
  console.error('Missing shared/ directory');
  process.exit(1);
}

for (const harness of harnesses) {
  const harnessRoot = path.join(root, harness);
  fs.mkdirSync(harnessRoot, { recursive: true });
  for (const dir of DEST_DIRS) {
    const src = path.join(sharedRoot, dir);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(harnessRoot, dir);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDir(src, dest);
  }
  // Drop kit dirs that are no longer in shared/ so harness copies stay in lockstep.
  for (const dir of DROPPED_DIRS) {
    const dest = path.join(harnessRoot, dir);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }
}

console.log('Synced shared/ into cursor/, claudecode/, codex/, and copilot/');
