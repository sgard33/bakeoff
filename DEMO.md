# Bakeoff demo — run of show

Same PM prompt, same model, one shot each in Cursor / Claude Code / Codex / Copilot.

**Scoring was intentionally removed** so Sofie can rebuild it. Per-prompt metrics (`record-prompt.mjs`) remain.

## Layout

```
bakeoff/
├── PROMPT.md          # paste into each tool
├── DEMO.md            # this run-of-show
├── shared/            # marketing kit (source of truth)
├── sync-shared.mjs / reset.mjs / record-prompt.mjs / start-run.mjs / end-run.mjs
├── cursor/            # Cursor working directory (open as Cursor project)
├── claudecode/        # Claude Code working directory
├── codex/             # Codex working directory
└── copilot/           # Copilot / VS Code working directory
```

Each harness has starter `index.html` + `style.css` and a synced copy of the marketing kit.

## Timed race (~8–12 min)

1. `npm run reset` — syncs shared kit, restores starters, clears timing artifacts.
2. Open four folders (or fewer if the machine is tight):
   - Cursor → `cursor/`
   - Claude Code → `claudecode/`
   - Codex → `codex/`
   - Copilot (agent mode / workspace) → `copilot/`
3. Paste `PROMPT.md` into each. One shot only.
4. After each agent stops, check `<harness>/bakeoff/prompts.jsonl` and `totals.json` (hooks append automatically).
   Optional manual refresh for delayed Cursor Admin API cost:
   ```bash
   npm run prompt-log -- cursor refresh
   ```

Manual fallback (if hooks aren’t in play): `npm run prompt-log -- <harness> start` before the prompt, `stop` after.

For non-interactive CLI runs, use `npm run run:cursor`, `npm run run:claude`, or `npm run run:codex`. These wrappers preserve native hooks and guarantee start/stop collection when a CLI version skips them.

## Automatic per-prompt metrics (hooks)

Every user→agent turn is logged for Cursor, Claude Code, and Codex:

- **Cursor** (`cursor/.cursor/hooks.json`): `beforeSubmitPrompt` → start; `stop` → stop + append to `prompts.jsonl`.
- **Claude Code** (`claudecode/.claude/settings.json`): `UserPromptSubmit` → start; `Stop` → stop.
- **Codex** (`codex/.codex/hooks.json`): `UserPromptSubmit` → start; `Stop` → stop.

**Codex demo-day notes:** Open `codex/` as the project cwd (not the bakeoff root). Trust the project layer and review/trust hooks via `/hooks` on first run — project-local `.codex/` hooks load only when trusted.

Copilot still uses manual `npm run start-run -- copilot` / `end-run`.

## Copilot notes

Open `copilot/` as the Copilot / VS Code workspace for the timed one-shot — same `PROMPT.md` as the other harnesses. You can still briefly narrate Copilot’s Tab / inline strengths as a contrast.

## Preview

This bakeoff is static HTML — no app ports. Open each harness `index.html` in a browser, or `python3 -m http.server` from the harness folder if you prefer.

## Commands cheat sheet

```bash
cd /Users/sofie.garden/code/demos/bakeoff
npm run reset
npm run run:cursor
npm run run:claude
npm run run:codex
npm run start-run -- copilot
npm run verify-metrics -- cursor claudecode codex
# scoring intentionally removed — rebuild when ready
```
