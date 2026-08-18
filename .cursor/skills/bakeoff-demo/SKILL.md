---
name: bakeoff-demo
description: >-
  Start, reset, run, or troubleshoot the two-turn interactive CLI bakeoff at
  code/demos/bakeoff. Starts metrics for Cursor vs Claude Code or Cursor vs
  Codex and prompts for the pair when it is not specified.
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

Determine the race pair from the user's request:

- Cursor vs Claude Code: `cursor claudecode`
- Cursor vs Codex: `cursor codex`

If the user did not specify a pair, use `AskQuestion` to ask them to choose
between **Cursor vs Claude Code** and **Cursor vs Codex**. Do not choose for
them.

Run the commands yourself in the repository root; do not only tell the user
what to run. When starting a fresh demo, reset first:

```bash
cd /Users/sofie.garden/code/demos/bakeoff
npm run reset
npm run race -- cursor claudecode
# Or:
npm run race -- cursor codex
```

Run exactly one `npm run race` command for the selected pair. Report that the
race is ready, then tell the user to run the plan and build turns in both
interactive CLIs.

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
