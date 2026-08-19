# Bakeoff demo — run of show

## Before the demo

Run `npm run reset` only when you want to restore all harnesses to their starter
pages. It overwrites each harness's `index.html` and `style.css`.

Open Cursor in `cursor/` and the comparison tool in its matching directory:

- Claude Code: `claudecode/`
- Codex: `codex/`
- Copilot / VS Code: `copilot/`

## Demo

1. Give both tools the prompt from `PROMPT.md`.
2. Ask both tools to plan the pricing page.
3. Ask both tools to build their plans.
4. Serve each harness over HTTP to compare the results:

   ```bash
   cd cursor
   python3 -m http.server 8080
   ```

Use a different port for the second harness.
