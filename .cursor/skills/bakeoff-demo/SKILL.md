---
name: bakeoff-demo
description: >-
  Reset and run the two-turn interactive CLI bakeoff at code/demos/bakeoff.
  Use when preparing, resetting, or troubleshooting Cursor vs Claude Code or
  Cursor vs Codex races and their metrics report.
---

# Bakeoff Demo

**Root:** `/Users/sofie.garden/code/demos/bakeoff`

The demo runs two interactive CLIs side by side. Each harness completes exactly
two measured turns:

1. **Plan** — same model, plan mode.
2. **Build** — agent mode; Cursor may switch to Auto Cost.

The first completed turn is labeled `plan`; the second is labeled `build`.

## Setup

Read `README.md` and `DEMO.md` before changing or running the demo.

Cursor interactive collection requires these gitignored root `.env` values:

```bash
CURSOR_ADMIN_API_KEY=key_...
CURSOR_ADMIN_EMAIL=you@example.com
```

`CURSOR_ADMIN_EMAIL` may be omitted when `git config user.email` matches the
Cursor account.

Open each CLI in its harness directory so project hooks load:

- Cursor CLI: `cursor/`
- Claude Code: `claudecode/`
- Codex: `codex/`

Codex project hooks may require explicit trust on first use.

## Run

```bash
npm run reset
npm run race -- cursor claudecode
# Or:
npm run race -- cursor codex
```

Run the plan and build turns in both interactive CLIs. Open
`metrics/report.html`; it refreshes every eight seconds.

## Capture sources

- **Cursor:** hook timestamps plus user-filtered Cursor Admin API events.
  Headline cost is undiscounted `tokenUsage.totalCents`, not billed
  `chargedCents`. Collection happens in a detached process after the stop hook.
- **Claude Code:** exact usage from assistant messages in the interactive
  transcript. Cost is computed from the recorded model's list rates unless
  manually overridden from `/usage`.
- **Codex:** exact `last_token_usage` from the interactive rollout. Cost is
  computed only when the model has a configured list-price profile.

Do not run other Cursor agents during a measured Cursor turn. Admin events are
filterable by user and time, but not by terminal session. The report shows event
count and model names so overlap is visible.

## Manual Claude cost

```bash
npm run set-cost -- claudecode plan <usd>
npm run set-cost -- claudecode build <usd>
```

## Reset and history

`npm run reset` first archives the active race and its standalone report under
`metrics/history/<timestamp>-<pair>/`, then clears current metrics, syncs the
shared marketing kit, and overwrites each harness `index.html` / `style.css`
with starter templates.

Do not reset if a built harness page still needs to be inspected.

## Verification

```bash
npm run verify-metrics
node --check metrics.mjs
node --check reset.mjs
node --check verify-metrics.mjs
```

The verifier checks hook configuration and executable scripts. With an active
race, it also requires complete plan and build records with positive duration,
tokens, and list cost for both harnesses.
