# Implementation notes — marketing pages

## Pricing page requirements

- Update only `index.html` and `style.css` in the harness root.
- Pull plan names, prices, features, and CTAs from `content/pricing.json`. Do not invent pricing.
- Pro is the recommended plan. Use the exact badge text from `popular_badge` in that JSON.
- Annual billing is cheaper by `annual_discount_percent` (show the `annual_save_label`).
- Use CSS variables from `tokens/brand.css` (`--color-accent`, `--color-bg`, `--color-card`, `--radius-md`, etc.).
- No external CSS/JS libraries or CDNs.
- Follow class naming from `components/` snippets: `pricing-card`, `tier`, `badge`, `billing-toggle`, `btn` / `cta`.
- Billing toggle must be keyboard accessible (`role="group"`, labeled control).
- Mobile: stack the three tiers below `--breakpoint-mobile` (768px).

## Out of scope

- Do not rewrite the landing page, blog, or dashboard notes.
- Do not change files under `bakeoff/` (scoring harness).
