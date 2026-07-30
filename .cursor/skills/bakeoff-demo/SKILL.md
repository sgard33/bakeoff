---
name: bakeoff-demo
description: >-
  Reset and run the one-shot bakeoff demo at code/demos/bakeoff across four
  harnesses (Cursor, Claude Code, Codex, Copilot). Use when the user asks to
  reset the bakeoff demo, sync the shared marketing kit, or set up the dual/quad
  harness race track. Scoring was intentionally removed for Sofie to rebuild.
---

# Bakeoff Demo

One-shot harness comparison: **same PM-style prompt, same model**, built once in Cursor, Claude Code, Codex, and Copilot.

**Root:** `/Users/sofie.garden/code/demos/bakeoff`

**Scoring intentionally removed** — Sofie will rebuild it. Timing helpers remain.

## The point of the demo

Accuracy is expected to be roughly a **draw** — both produce a good page. Cursor typically wins on **speed** and **token efficiency** because the task requires searching a small marketing codebase (tokens, pricing JSON, component snippets).

## Layout

```
bakeoff/
├── PROMPT.md        # PM-style prompt — paste into each tool
├── DEMO.md          # run-of-show
├── shared/          # marketing kit (source of truth) — synced into harnesses
├── sync-shared.mjs
├── start-run.mjs / end-run.mjs / collect-tokens.mjs / stamp-duration.mjs
├── reset.mjs
├── cursor/          # open in Cursor, run the prompt here
├── claudecode/      # open in Claude Code, run the prompt here
├── codex/           # open in Codex, run the prompt here
└── copilot/         # open in Copilot / VS Code, run the prompt here
```

Each harness folder has `index.html`, `style.css`, and a synced copy of the marketing kit (`content/`, `tokens/`, `components/`, …).

## Demo flow

1. Reset and open the tools. Show `PROMPT.md` (and `DEMO.md` for the run-of-show).
2. Paste the same prompt into Cursor (`cursor/`), Claude Code (`claudecode/`), Codex (`codex/`), and Copilot (`copilot/`).
3. Let each do one shot. Timing and token usage are captured automatically via hooks where configured.
4. Copilot still uses manual `end-run` for tokens.

Scoring / compare / report.html are gone — rebuild when ready.

## Automatic token capture (hooks)

Stop hooks call `collect-tokens.mjs` after `stamp-duration`:

- **Codex** — reads latest matching `~/.codex/sessions/**/rollout-*.jsonl` for harness cwd
- **Claude Code** — parses Stop hook `transcript_path` JSONL (deduped assistant usage)
- **Cursor (interactive)** — Cursor Admin API via `CURSOR_ADMIN_API_KEY` in `.env` or shell
- **Cursor (headless)** — `bash cursor/run-cursor.sh` tees stream-json to `cursor/bakeoff/run.jsonl`

Manual fallback:

```bash
npm run collect-tokens -- codex
npm run end-run -- copilot --tokens 11000 --input 7500 --output 3500
```

## Automatic timing (hooks)

Wall-clock time is captured automatically — no manual `start-run` needed:

- Cursor (`.cursor/hooks.json`):
  - `beforeSubmitPrompt` → `start-run.mjs cursor --if-missing` stamps the start clock on the first prompt of a build.
  - `stop` → `stamp-duration.mjs cursor` then `collect-tokens.mjs cursor`.
- Claude Code (`claudecode/.claude/settings.json`):
  - `UserPromptSubmit` → `stamp-start.sh` stamps the start clock.
  - `Stop` → `stamp-duration.sh` then `collect-tokens.sh` (reads `transcript_path` from hook stdin).
- Codex (`codex/.codex/hooks.json`):
  - `UserPromptSubmit` → `stamp-start.sh` stamps the start clock.
  - `Stop` → `stamp-duration.sh` then `collect-tokens.sh`.
  - Open `codex/` as cwd; trust the project layer and hooks via `/hooks` on first run.
- Copilot: open `copilot/` as the workspace; use manual `npm run start-run -- copilot` / `end-run` (no tool-specific hooks in this repo).

`stamp-duration` preserves tokens already recorded via `end-run` or `collect-tokens`. Manual `npm run start-run -- <harness>` still works and overrides the automatic clock.

## Why Cursor should win on speed

The prompt requires discovering:

- `content/pricing.json` — canonical prices / features / CTAs
- `content/changelog.json` — extra search target / release context
- `tokens/brand.css` — CSS variables
- `components/*` — class vocabulary (`card`, `tier`, `badge`, `billing-toggle`, `cta`)
- `docs/brand.md` / `docs/implementation-notes.md` — constraints

Agents that invent prices or ignore tokens lose accuracy. Fast workspace search (Cursor) reduces wall-clock time and tokens vs manual exploration.

## run-meta.json

Written by hooks / `collect-tokens` / `end-run` under `<harness>/bakeoff/`:

```json
{
  "harness": "codex",
  "duration_ms": 105016,
  "cost_usd": 0.90848,
  "cost_source": "computed",
  "token_source": "codex_rollout",
  "tokens": {
    "input": 112411,
    "cached_input": 2059008,
    "cache_write_input": 0,
    "output": 11270,
    "reasoning_output": 2802,
    "total": 2182689,
    "source": "exact"
  }
}
```

## Reset

```bash
cd /Users/sofie.garden/code/demos/bakeoff && npm run reset
```

Re-syncs `shared/` into all four harnesses, restores starter HTML/CSS, and clears timing artifacts (`run-meta.json`, `run-start.json`, `run.log`, `run.jsonl`) plus `report.html` if present.
