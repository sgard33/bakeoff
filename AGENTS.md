# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A static-HTML "bakeoff" demo (see `README.md` and `DEMO.md`). It compares AI coding
tools by having each build the same three-tier pricing page from a shared marketing
kit. `shared/` is the source of truth; `cursor/`, `claudecode/`, `codex/`, and
`copilot/` are scratch harness workspaces that the kit is synced into.

### Dependencies / setup
There are no third-party dependencies, no lockfile, and no `node_modules` — the Node
scripts use only built-in modules. Nothing needs to be installed. Requires Node
(built-in modules only) and, for previews, `python3`. There is **no build step**.

### Commands
Use the npm scripts defined in `package.json` (documented in `README.md`):
`sync`, `reset`, `race`, `report`, `set-cost`, `verify-metrics`. Do not duplicate
their usage here — read `README.md` / `DEMO.md`.

### Lint / test / build
None are configured (no ESLint, no test runner, no bundler). For a quick sanity check
of the orchestration scripts, run `node --check <file>.mjs`.

### Previewing a harness pricing page
This is static HTML with no app server. Serve a harness folder and open it, e.g.
`cd copilot && python3 -m http.server 8080` then open `http://localhost:8080/index.html`.
Prefer serving over HTTP rather than `file://` so the relative `tokens/` and CSS links
resolve. A harness `index.html` should link brand tokens via `tokens/brand.css` and
pull prices/features from `content/pricing.json` — never hardcode pricing.

### Gotchas
- `npm run reset` overwrites every harness `index.html` / `style.css` with the starter
 templates hardcoded in `reset.mjs`. It archives the active metrics race first. Do
 **not** run it if you want to keep a page you built in a harness.
- Generated race data and reports under `metrics/` are gitignored.
- Cursor interactive metrics require `CURSOR_ADMIN_API_KEY` in the root `.env`.
 `CURSOR_ADMIN_EMAIL` is optional when `git config user.email` matches the Cursor
 account. Claude Code and Codex collectors read local CLI telemetry (`~/.claude`,
 `~/.codex`) that will not exist in a fresh cloud VM.
