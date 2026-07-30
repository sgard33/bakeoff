# Bakeoff demo

One-shot harness comparison: **same PM-style prompt, same model**, built once in Cursor, Claude Code, Codex, and Copilot.

Each tool gets an identical task — build a pricing page from a shared marketing kit — so you can compare wall-clock speed and token usage side by side. Accuracy is expected to be roughly a draw; the demo is designed to show where fast workspace search pays off.

## Quick start

```bash
npm run reset
```

Open each harness folder in its tool, paste the prompt from [`PROMPT.md`](PROMPT.md), and let each agent run one shot:

| Tool | Working directory |
|------|-------------------|
| Cursor | `cursor/` |
| Claude Code | `claudecode/` |
| Codex | `codex/` |
| Copilot | `copilot/` |

Preview the result by opening each harness `index.html` in a browser.

For a full run-of-show, see [`DEMO.md`](DEMO.md).

## Layout

```
bakeoff/
├── PROMPT.md          # paste into each tool
├── DEMO.md            # run-of-show
├── shared/            # marketing kit (source of truth)
├── sync-shared.mjs    # sync shared/ into harness folders
├── reset.mjs          # reset starters + timing artifacts
├── start-run.mjs      # manual start clock
├── end-run.mjs        # record tokens + finalize timing
├── stamp-duration.mjs # hook helper: freeze duration
├── cursor/            # Cursor working directory
├── claudecode/        # Claude Code working directory
├── codex/             # Codex working directory
└── copilot/           # Copilot / VS Code working directory
```

Each harness has starter `index.html` + `style.css` and a synced copy of the marketing kit (`content/`, `tokens/`, `components/`, `docs/`, …).

## The task

The prompt asks each agent to build a three-tier pricing page (Starter, Pro, Enterprise) using:

- Canonical prices from `content/pricing.json` — not placeholder numbers
- Brand tokens from `tokens/brand.css`
- Component patterns from `components/`
- Guidelines in `docs/`

Agents that search the codebase and reuse existing patterns tend to finish faster with fewer tokens.

## Timing

Wall-clock time is captured automatically for Cursor, Claude Code, and Codex via lifecycle hooks:

- **Cursor** — `.cursor/hooks.json` (`beforeSubmitPrompt` → start, `stop` → duration)
- **Claude Code** — `claudecode/.claude/settings.json` (`UserPromptSubmit` → start, `Stop` → duration)
- **Codex** — `codex/.codex/hooks.json` (`UserPromptSubmit` → start, `Stop` → duration)

**Codex notes:** Open `codex/` as the project cwd. Trust the project layer and approve hooks via `/hooks` on first run.

**Copilot** uses manual timing:

```bash
npm run start-run -- copilot
# ... run the prompt ...
npm run end-run -- copilot --tokens <total> --input <N> --output <N>
```

After each run, timing is written to `<harness>/bakeoff/run-meta.json`:

```json
{
  "harness": "cursor",
  "duration_ms": 38000,
  "tokens": { "input": 6200, "output": 3400, "total": 9600, "source": "exact" }
}
```

Optionally record exact token counts from each tool's usage readout:

```bash
npm run end-run -- cursor --tokens 9600 --input 6200 --output 3400
npm run end-run -- claudecode --tokens 14000 --input 9000 --output 5000
npm run end-run -- codex --tokens 12000 --input 8000 --output 4000
npm run end-run -- copilot --tokens 11000 --input 7500 --output 3500
```

## Commands

```bash
npm run sync       # sync shared/ into all harness folders
npm run reset      # sync + restore starters + clear timing artifacts
npm run start-run -- <cursor|claudecode|codex|copilot>
npm run end-run -- <harness> --tokens <total> [--input N --output N]
```

## Scoring

Scoring and compare reporting were intentionally removed — timing helpers remain for rebuilding comparison tooling later.
