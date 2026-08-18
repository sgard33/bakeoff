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
| Cursor | `cursor/` (open as the Cursor project so harness hooks fire) |
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
├── record-prompt.mjs  # per-prompt metrics (start/stop/refresh)
├── start-run.mjs / end-run.mjs / collect-tokens.mjs
├── stamp-duration.mjs # legacy hook helper (superseded by record-prompt)
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

## Per-prompt metrics

Every user→agent turn is logged automatically for Cursor, Claude Code, and Codex via `record-prompt.mjs`:

- **Cursor** — `cursor/.cursor/hooks.json` (`beforeSubmitPrompt` → start, `stop` → stop)
- **Claude Code** — `claudecode/.claude/settings.json` (`UserPromptSubmit` → start, `Stop` → stop)
- **Codex** — `codex/.codex/hooks.json` (`UserPromptSubmit` → start, `Stop` → stop)

**Codex notes:** Open `codex/` as the project cwd. Trust the project layer and approve hooks via `/hooks` on first run.

For non-interactive CLI runs, use the wrappers so metrics are collected even when a CLI version skips native project hooks:

```bash
npm run run:cursor
npm run run:claude
npm run run:codex
```

Pass a prompt after `--` to override `PROMPT.md`, for example `npm run run:claude -- "Reply with ok"`.

**Copilot** uses manual timing:

```bash
npm run start-run -- copilot
# ... run the prompt ...
npm run end-run -- copilot --tokens <total> --input <N> --output <N>
```

After each completed turn, hooks append one line to `<harness>/bakeoff/prompts.jsonl` and update running totals in `<harness>/bakeoff/totals.json`. `run-meta.json` mirrors `totals.json` for backward compatibility.

Per-turn log line shape:

```json
{
  "harness": "claudecode",
  "prompt_index": 3,
  "started_at": "2026-08-06T04:00:00.000Z",
  "ended_at": "2026-08-06T04:00:42.100Z",
  "duration_ms": 42100,
  "tokens": {
    "input": 1200,
    "cached_input": 8000,
    "cache_write_input": 400,
    "output": 900,
    "reasoning_output": 0,
    "total": 10500,
    "source": "exact"
  },
  "cost_usd": 0.12,
  "cost_source": "reported",
  "token_source": "claude_transcript"
}
```

Running totals (`totals.json`):

```json
{
  "harness": "cursor",
  "prompt_count": 3,
  "duration_ms": 118400,
  "cost_usd": 0.41,
  "tokens": {
    "input": 6200,
    "cached_input": 12000,
    "cache_write_input": 3400,
    "output": 3400,
    "reasoning_output": 0,
    "total": 25000,
    "source": "exact"
  },
  "started_at": "2026-08-06T03:58:00.000Z",
  "last_ended_at": "2026-08-06T04:02:00.000Z"
}
```

Each stop hook also prints turn + running totals to stderr:

```
[claudecode] prompt #3  42.1s  in=1200 cache_r=8000 cache_w=400 out=900  $0.12
[claudecode] totals     3 prompts  118.4s  tokens=84200  $0.41
```

### Token sources per harness

| Harness | Source | Notes |
|---------|--------|-------|
| **Codex** | `~/.codex/sessions/**/rollout-*.jsonl` | Per-turn `last_token_usage`; cumulative delta fallback |
| **Claude Code** | `~/.claude/projects/<slug>/*.jsonl` | Watermark on assistant message ids; cost from `total_cost_usd` delta when present |
| **Cursor (interactive)** | Cursor Admin API | Per-turn window from `prompt-start.json`; requires `CURSOR_ADMIN_API_KEY` |
| **Cursor (headless)** | `cursor/bakeoff/run.jsonl` | Via `cursor/run-cursor.sh` + `--output-format stream-json` |

Setup for Cursor Admin API cost (interactive sessions):

1. Create a **Team** API key in [cursor.com/dashboard](https://cursor.com/dashboard) → Settings → API Keys.
2. Add it to a gitignored `.env` at the repo root:

```bash
CURSOR_ADMIN_API_KEY=key_...
```

Or export it in your shell. The collector reads `.env` without overriding existing environment variables.

CLI runs (capture usage immediately):

```bash
npm run run:cursor
npm run run:claude
npm run run:codex
```

Manual collection after a run:

```bash
npm run collect-tokens -- codex
npm run collect-tokens -- claudecode
npm run collect-tokens -- cursor
```

If Cursor Admin API events are delayed (hourly aggregation), refresh cost later:

```bash
npm run prompt-log -- cursor refresh
# or: npm run collect-tokens -- cursor --refresh-cost
```

Manual override (Copilot or fallback):

```bash
npm run end-run -- cursor --tokens 9600 --input 6200 --cached-input 12000 --output 3400 --cost 0.42
npm run end-run -- claudecode --tokens 14000 --input 9000 --output 5000
npm run end-run -- codex --tokens 2182689 --input 112411 --cached-input 2059008 --output 11270 --reasoning 2802
npm run end-run -- copilot --tokens 11000 --input 7500 --output 3500
```

## Commands

```bash
npm run sync       # sync shared/ into all harness folders
npm run reset      # sync + restore starters + clear timing artifacts
npm run start-run -- <cursor|claudecode|codex|copilot>
npm run end-run -- <harness> --tokens <total> [--input N --output N --cached-input N --cache-write N --reasoning N --cost N]
npm run prompt-log -- <cursor|claudecode|codex> <start|stop|refresh> [--transcript path] [--stream-json path]
npm run collect-tokens -- <cursor|claudecode|codex> [--transcript path] [--stream-json path] [--refresh-cost]
npm run run:<cursor|claude|codex> -- [prompt]
npm run verify-metrics -- cursor claudecode codex
```

## Scoring

Scoring and compare reporting were intentionally removed — timing helpers remain for rebuilding comparison tooling later.
