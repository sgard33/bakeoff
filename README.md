# Bakeoff demo

One-shot harness comparison: the same PM-style prompt and marketing kit are
used in Cursor, Claude Code, Codex, and Copilot.

## Quick start

```bash
npm run reset
```

Open each tool in its harness directory and paste the prompt from `PROMPT.md`.

- Cursor CLI: `cursor/`
- Claude Code: `claudecode/`
- Codex: `codex/`
- Copilot / VS Code: `copilot/`

See `DEMO.md` for the run of show.

## Commands

```bash
npm run sync
npm run reset
```

`shared/` is the source of truth for the marketing kit. Each harness receives
the same `content/`, `tokens/`, `components/`, and `docs/` files.
