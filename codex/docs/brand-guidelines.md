# Brand guidelines (marketing)

## Voice

- Clear, confident, short sentences.
- Prefer “Simple, transparent pricing” over clever taglines on commercial pages.

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--color-bg` | `#f5f7f6` | Page background |
| `--color-fg` | `#1c2421` | Primary text |
| `--color-accent` | `#0f766e` | CTAs, badges, emphasis |
| `--color-card` | `#eef1ef` | Cards / surfaces |
| `--color-border` | `#d4dcd8` | Borders |

## Components

- Primary CTA uses accent fill.
- Secondary CTA is outline / transparent.
- Popular tier gets accent border + `--shadow-popular`.
- Pills and save badges use `--radius-pill`.

## Do / Don’t

- Do reuse tokens from `tokens/brand.css`.
- Don’t introduce a second teal or competing accent color on this page.
- Don’t pull in Tailwind, Bootstrap, or icon fonts.
