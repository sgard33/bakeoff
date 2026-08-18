# Bakeoff demo — run of show

Two interactive CLIs, two turns, one report. Run Cursor against Claude Code or Cursor against Codex; never all three at once.

## Before the demo

The root `.env` must contain:

```bash
CURSOR_ADMIN_API_KEY=key_...
CURSOR_ADMIN_EMAIL=you@example.com
```

`CURSOR_ADMIN_EMAIL` may be omitted when `git config user.email` matches the Cursor account.

Open `cursor/` in Cursor CLI and either `claudecode/` in Claude Code or `codex/` in Codex. Trust the project hooks when the CLI asks.

## Cursor vs Claude Code

```bash
cd /Users/sofie.garden/code/demos/bakeoff
npm run reset
npm run race -- cursor claudecode
```

1. Set both CLIs to Claude Opus 5 and plan mode.
2. Paste the same planning prompt and submit both.
3. Wait for both plans to finish. This is automatically recorded as **Plan**.
4. Switch both to agent mode. Switch Cursor to Auto Cost; keep Claude Code on Opus 5.
5. Ask both agents to build the plan. This is automatically recorded as **Build**.
6. Open `metrics/report.html`. Cursor may briefly show “Syncing dashboard…” while its Admin API events arrive.
7. Optionally replace Claude’s computed cost with the value shown by `/usage`:

   ```bash
   npm run set-cost -- claudecode plan <usd>
   npm run set-cost -- claudecode build <usd>
   ```

8. Run `npm run verify-metrics`.

## Cursor vs Codex

Reset archives the prior report and restores the starter pages:

```bash
npm run reset
npm run race -- cursor codex
```

Repeat the same plan and build turns. Open `metrics/report.html`, then run `npm run verify-metrics`.

## What the report means

- Cursor tokens and undiscounted list cost come from the same Admin API events used by the dashboard.
- Claude Code tokens come from its interactive transcript. Cost is computed from list rates unless manually overridden from `/usage`.
- Codex tokens come from its interactive rollout. Cost is computed only when the recorded model has a configured list-price profile.
- Timing is wall-clock time from prompt submission until the CLI’s stop hook.
- The first completed turn is always Plan; the second is always Build.

Avoid other Cursor agent activity during a Cursor turn. Admin events do not identify a specific terminal session, so overlapping activity under the same email can contaminate the turn. The report shows models and event count to make overlap visible.
