---
name: bakeoff-demo
description: >-
  Reset and run the one-shot bakeoff demo at code/demos/bakeoff across four
  harnesses (Cursor, Claude Code, Codex, Copilot). Use when the user asks to
  reset the bakeoff demo, sync the shared marketing kit, or set up the dual/quad
  harness comparison.
---

# Bakeoff Demo

One-shot harness comparison: **same PM-style prompt, same model**, built once in Cursor, Claude Code, Codex, and Copilot.

**Root:** `/Users/sofie.garden/code/demos/bakeoff`

## The point of the demo

Accuracy is expected to be roughly a **draw** — both produce a good page. Cursor typically wins on **speed** and **token efficiency** because the task requires searching a small marketing codebase (tokens, pricing JSON, component snippets).

## Layout

```
bakeoff/
├── PROMPT.md        # PM-style prompt — paste into each tool
├── DEMO.md          # run-of-show
├── shared/          # marketing kit (source of truth) — synced into harnesses
├── sync-shared.mjs
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
3. Let each do one shot.
4. Serve each harness over HTTP to compare results, e.g. `cd cursor && python3 -m http.server 8080`. Use a different port per harness.

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

Re-syncs `shared/` into all four harnesses and restores starter HTML/CSS. Do **not** run it if you want to keep a page you built in a harness.
