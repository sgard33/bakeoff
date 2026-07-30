# Accessibility checklist — interactive marketing UI

- Provide an accessible name for the billing period control (`aria-label` or visible label association).
- Wrap related monthly/annual controls in `role="group"` with `aria-label="Billing period"`.
- Ensure color contrast: accent on white/cream surfaces meets WCAG AA for large text and badges.
- Cards should remain readable when stacked on narrow viewports; avoid relying on hover-only info.
- Prefer semantic headings: one `h1` for the page, `h2` for each plan tier name.
