# Bakeoff demo

One-shot harness comparison: **same PM-style prompt, same model**, built once in Cursor, Claude Code, Codex, and Copilot.

Each tool gets an identical task — build a pricing page from a shared marketing kit — so you can compare wall-clock speed and token usage side by side. Accuracy is expected to be roughly a draw; the demo is designed to show where fast workspace search pays off.

## Quick start

```bash
npm run reset
npm run race -- cursor claudecode
# Or: npm run race -- cursor codex
```

Open the two harness folders in their interactive CLIs. Start Cursor with an
explicit model so project hooks load:

```bash
cd cursor
cursor-agent --model claude-opus-5-thinking-high
```

Do not launch measured Cursor turns with a bare `cursor-agent` command. In the
current CLI, the hook set loads when `--model` is explicit; MAX models are
supported. Also stay interactive: `--print` runs `sessionStart` but not the
`beforeSubmitPrompt` hook that starts turn timing. Each race is exactly two
completed turns:

1. Plan mode with the same model in both tools.
2. Agent mode to build the plan. Cursor may switch to Auto Cost for this turn.

| Tool | Working directory |
|------|-------------------|
| Cursor CLI | `cursor/` |
| Claude Code | `claudecode/` |
| Codex | `codex/` |

Hooks capture each turn automatically. Open [`metrics/report.html`](metrics/report.html) to watch the report; it refreshes every eight seconds.

Cursor resolves project hooks from the git root even when its CLI starts in
`cursor/`, so Cursor metrics hooks live in the root `.cursor/` directory.
Claude Code continues to load its independent hooks from
`claudecode/.claude/`; the two hook systems do not conflict. Do not run any
other Cursor agent sessions in this repository while a race is active because
the root hooks would record those prompts as bakeoff turns.

For a full run-of-show, see [`DEMO.md`](DEMO.md).

## Layout

```
bakeoff/
├── .cursor/           # root Cursor hooks and bakeoff-demo skill
├── PROMPT.md          # paste into each tool
├── DEMO.md            # run-of-show
├── shared/            # marketing kit (source of truth)
├── sync-shared.mjs    # sync shared/ into harness folders
├── reset.mjs          # archive metrics + reset starters
├── metrics.mjs        # hooks, collection, history, and report
├── metrics/           # current race, history, report.html
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

## Two-turn metrics

`metrics.mjs` records exactly two completed turns per harness:

| Turn | Phase |
|------|-------|
| First | Plan |
| Second | Build |

The report shows input, output, cache-read, cache-write, total tokens, wall-clock duration, and undiscounted list cost for each phase and in total.

### Sources

| Harness | Tokens | List cost |
|---------|--------|-----------|
| Cursor CLI | Cursor Admin API events in the hook-stamped turn window | Admin API `tokenUsage.totalCents` |
| Claude Code | Interactive transcript assistant usage | Computed from the actual model and token categories |
| Codex | Interactive rollout `last_token_usage` | Computed when the model has a configured price profile |

Cursor collection runs in the background after the stop hook. The report initially says “Syncing dashboard…” and updates when the Admin API events stabilize.

### Cursor Admin API setup

Add both values to the gitignored root `.env`:

```bash
CURSOR_ADMIN_API_KEY=key_...
CURSOR_ADMIN_EMAIL=you@example.com
```

If `CURSOR_ADMIN_EMAIL` is omitted, the collector uses `git config user.email`. A user email is always required; collection fails closed rather than mixing team-wide usage into the race. Avoid other Cursor activity during a timed turn; the report displays the event count and models so possible overlap is visible.

### Claude `/usage` override

Interactive Claude transcripts do not persist the cost shown by `/usage`. The report computes list cost by default. To replace one turn with the displayed value:

```bash
npm run set-cost -- claudecode plan 1.23
npm run set-cost -- claudecode build 4.56
```

### Storage and reset

Current results live in `metrics/current/`. `npm run reset` archives an existing race to `metrics/history/<timestamp>-<pair>/`, including its standalone report, then clears current metrics and restores every harness starter.

## Commands

```bash
npm run sync
npm run reset
npm run race -- cursor claudecode
npm run race -- cursor codex
npm run report
npm run set-cost -- claudecode <plan|build> <usd>
npm run verify-metrics
```
