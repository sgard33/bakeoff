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

**Scoring intentionally removed** — Sofie will rebuild it. Per-prompt metrics helpers remain.

## The point of the demo

Accuracy is expected to be roughly a **draw** — both produce a good page. Cursor typically wins on **speed** and **token efficiency** because the task requires searching a small marketing codebase (tokens, pricing JSON, component snippets).

## Layout

```
bakeoff/
├── PROMPT.md        # PM-style prompt — paste into each tool
├── DEMO.md          # run-of-show
├── shared/          # marketing kit (source of truth) — synced into harnesses
├── sync-shared.mjs
├── record-prompt.mjs / start-run.mjs / end-run.mjs / collect-tokens.mjs
├── reset.mjs
├── cursor/          # open in Cursor as project root, run the prompt here
├── claudecode/      # open in Claude Code, run the prompt here
├── codex/           # open in Codex, run the prompt here
└── copilot/         # open in Copilot / VS Code, run the prompt here
```

Each harness folder has `index.html`, `style.css`, and a synced copy of the marketing kit (`content/`, `tokens/`, `components/`, …).

## Demo flow

1. Reset and open the tools. Show `PROMPT.md` (and `DEMO.md` for the run-of-show).
2. Paste the same prompt into Cursor (`cursor/`), Claude Code (`claudecode/`), Codex (`codex/`), and Copilot (`copilot/`).
3. Let each do one shot. Per-prompt timing and token usage are captured automatically via hooks where configured.
4. Copilot still uses manual `end-run` for tokens.

Scoring / compare / report.html are gone — rebuild when ready.

## Per-prompt metrics (hooks)

Hooks call `record-prompt.mjs` on every user→agent turn:

- **Codex** — cumulative rollout delta vs `usage-snapshot.json`
- **Claude Code** — transcript watermark on assistant message ids; `total_cost_usd` delta when present
- **Cursor (interactive)** — Admin API per-turn window via `CURSOR_ADMIN_API_KEY` in `.env` or shell
- **Cursor (headless)** — `bash cursor/run-cursor.sh` tees stream-json to `cursor/bakeoff/run.jsonl`

Artifacts under `<harness>/bakeoff/`:

| File | Role |
|------|------|
| `prompts.jsonl` | Append-only log — one object per completed turn |
| `totals.json` | Running aggregates since last reset |
| `run-meta.json` | Mirror of `totals.json` for backward compatibility |
| `prompt-start.json` | Active turn clock (removed on stop) |
| `usage-snapshot.json` | Cumulative watermark for delta collection |

Manual fallback:

```bash
npm run prompt-log -- codex start
npm run prompt-log -- codex stop
npm run collect-tokens -- claudecode
npm run end-run -- copilot --tokens 11000 --input 7500 --output 3500
```

## Hook wiring

- Cursor (`cursor/.cursor/hooks.json`) — open **`cursor/`** as the Cursor project:
  - `beforeSubmitPrompt` → `record-prompt.mjs cursor start`
  - `stop` → `record-prompt.mjs cursor stop`
- Claude Code (`claudecode/.claude/settings.json`):
  - `UserPromptSubmit` → `record-prompt.mjs claudecode start`
  - `Stop` → `record-prompt.mjs claudecode stop` (reads `transcript_path` from hook stdin)
- Codex (`codex/.codex/hooks.json`):
  - `UserPromptSubmit` → `record-prompt.mjs codex start`
  - `Stop` → `record-prompt.mjs codex stop`
  - Open `codex/` as cwd; trust the project layer and hooks via `/hooks` on first run.
- Copilot: open `copilot/` as the workspace; use manual `npm run start-run -- copilot` / `end-run`.

Stop hooks print turn + running totals to stderr:

```
[claudecode] prompt #3  42.1s  in=1200 cache_r=8000 cache_w=400 out=900  $0.12
[claudecode] totals     3 prompts  118.4s  tokens=84200  $0.41
```

## Why Cursor should win on speed

The prompt requires discovering:

- `content/pricing.json` — canonical prices / features / CTAs
- `content/changelog.json` — extra search target / release context
- `tokens/brand.css` — CSS variables
- `components/*` — class vocabulary (`card`, `tier`, `badge`, `billing-toggle`, `cta`)
- `docs/brand.md` / `docs/implementation-notes.md` — constraints

Agents that invent prices or ignore tokens lose accuracy. Fast workspace search (Cursor) reduces wall-clock time and tokens vs manual exploration.

## Reset

```bash
cd /Users/sofie.garden/code/demos/bakeoff && npm run reset
```

Re-syncs `shared/` into all four harnesses, restores starter HTML/CSS, and clears timing artifacts (`prompts.jsonl`, `totals.json`, `run-meta.json`, `prompt-start.json`, `usage-snapshot.json`, `run.log`, `run.jsonl`) plus `report.html` if present.
