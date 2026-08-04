#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { agentLog } from './debug-log.mjs';

const cwd = process.cwd();

// #region agent log
agentLog({
  hypothesisId: 'H1',
  location: '.cursor/hooks/debug-stop.mjs',
  message: 'stop hook command entered',
  data: {
    cwd,
    node: process.execPath,
    stampExists: fs.existsSync(path.join(cwd, 'stamp-duration.mjs')),
    collectExists: fs.existsSync(path.join(cwd, 'collect-tokens.mjs')),
    startExists: fs.existsSync(path.join(cwd, 'cursor/bakeoff/run-start.json')),
    metaExists: fs.existsSync(path.join(cwd, 'cursor/bakeoff/run-meta.json')),
  },
});
// #endregion
