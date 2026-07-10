# Design System – NUAR CRM

## 🎨 Design Tokens

The source of truth for all visual values lives in **`src/styles/tokens.css`**. Each token is exposed as a CSS variable (`--*`) and referenced throughout the codebase via Tailwind configuration.

| Category | Tokens | Example Usage |
|----------|--------|---------------|
| **Colors** | `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent-success`, `--accent-warning`, `--accent-error`, `--accent-info`, `--brand-accent` | `bg-background` → `background: var(--bg);`
| **Radii** | `--radius-sm`, `--radius-md`, `--radius-card`, `--radius-modal`, `--radius-control`, `--radius-pill` | `rounded-control` → `border-radius: var(--radius-control);`
| **Spacing** | `--space-1` … `--space-8` | `p-2` → `padding: var(--space-2);`
| **Typography** | `--font-main`, `--text-xs`, `--text-sm`, `--text-md`, `--text-lg` | `font-sans` → `font-family: var(--font-main);`
| **Shadows** | `--shadow-layer` | `shadow-layer` → `box-shadow: var(--shadow-layer);`

All tokens are defined in `:root` so they are globally available and automatically switch with the **dark‑mode** class.

## 🧩 UI Primitives

Reusable components live under `src/components/ui/` and **must** be used instead of native HTML elements:

| Component | Purpose | Key Props |
|-----------|---------|----------|
| `Button` | Consistent button styling, handles `disabled` state. | `variant="primary|secondary|danger|success"`, `disabled`, `onClick` |
| `Input` | Styled text input, forwards all native props. | `type`, `placeholder`, `value`, `onChange`, `autoComplete` |
| `Select` | Styled dropdown, supports custom options. | `options`, `value`, `onChange`, `disabled` |
| `Table` | Wrapper for accessible tables with consistent spacing. | `columns`, `data` |

All primitives use the design tokens via Tailwind utility classes (e.g. `text-textPrimary`, `bg-surface`, `rounded-control`).

## 📐 Layout Guidelines

- **Spacing**: use Tailwind spacing utilities (`m-2`, `p-4`, etc.) – they map directly to `--space-*`.
- **Typography**: head‑ings use `text-xl`/`text-2xl` which resolve to `--text-*` values.
- **Borders & Radii**: prefer Tailwind classes like `border`, `rounded-card`, `rounded-control`.
- **Shadows**: use `shadow-layer` for elevated elements (modals, cards).

## ✅ CI / Linting Recommendations

1. **Stylelint** – add a rule to forbid hard‑coded `px` values in CSS/JSX:
    ```json
    "declaration-no-important": true,
    "unit-disallowed-list": ["px"]
    ```
2. **ESLint** – enable `no-inline-styles` to keep styling inside the design system.
3. Run `npm run lint` in CI before building.

## 📦 Deployment

All visual changes are pure CSS/Tailwind. After merging to `main`, Vercel automatically rebuilds:
```
git push origin main
```
Monitor the deployment at **https://nuarr.pl** and verify that the UI matches the token definitions.

---
*Last updated: 2026‑07‑09*
