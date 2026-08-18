# Marketing site kit (shared)

This folder is synced into `cursor/`, `claudecode/`, `codex/`, and `copilot/` harnesses.

Agents building the pricing page should **search and reuse** these files:

| Path | Why it matters |
| --- | --- |
| `content/pricing.json` | Canonical plan names, prices, features, CTAs |
| `content/changelog.json` | Recent release notes (extra search target) |
| `tokens/brand.css` | Brand CSS variables |
| `components/*.html` | Expected class names (`card`, `tier`, `badge`, `billing-toggle`, `cta`) |
| `docs/brand-guidelines.md` | Brand voice, color tokens, and component rules |
| `docs/accessibility.md` | A11y checklist for the billing toggle + cards |
| `docs/implementation-notes.md` | Constraints (no CDN, Pro recommended, etc.) |
| `reference/landing.html` | Visual / component language |
| `reference/pricing-old.html` | Distractor — wrong prices, do not use |

Do not edit this kit during a bakeoff run. Only `index.html` and `style.css` at the harness root are the deliverable.
