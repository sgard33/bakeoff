# Brand guidelines (marketing)

## Voice

- Clear, confident, short sentences.
- Prefer “Simple, transparent pricing” over clever taglines on commercial pages.

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--color-bg` | `#f7f7f4` | Page background |
| `--color-fg` | `#26251e` | Primary text |
| `--color-accent` | `#f54e00` | CTAs, badges, emphasis |
| `--color-card` | `#f2f1ed` | Cards / surfaces |
| `--color-border` | `#e1e0db` | Borders |

## Components

- Primary CTA uses accent fill.
- Secondary CTA is outline / transparent.
- Popular tier gets accent border + `--shadow-popular`.
- Pills and save badges use `--radius-pill`.

## Do / Don’t

- Do reuse tokens from `tokens/brand.css`.
- Don’t introduce a second orange or a dark theme for this page.
- Don’t pull in Tailwind, Bootstrap, or icon fonts.
