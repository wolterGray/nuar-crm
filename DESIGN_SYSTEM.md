# NUAR CRM Design System

Last updated: 2026-07-17

## Source Of Truth

The canonical runtime tokens live in `src/styles/tokens.css`.

New UI work should use semantic tokens first:

- Colors: `--color-page`, `--color-window`, `--color-card`, `--color-field`, `--color-border`, `--color-text`, `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`, `--color-premium`.
- Typography: `--font-main`, `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl`, `--font-weight-*`, `--line-height-*`.
- Spacing: `--space-1` through `--space-12`.
- Radius: `--radius-sm`, `--radius-md`, `--radius-card`, `--radius-modal`, `--radius-control`, `--radius-control-sm`, `--radius-dropdown`, `--radius-pill`.
- Effects: `--shadow-card`, `--shadow-dropdown`, `--shadow-modal`, `--shadow-toast`, `--shadow-focus`, `--transition-ui`.
- Sizes: `--control-height-*`, `--icon-size-*`, `--icon-button-size-*`, `--avatar-size-*`.

Legacy tokens are intentionally still present for backward compatibility. Do not delete them during page work; migrate page by page.

## UI Primitives

Reusable primitives live in `src/components/ui/`.

- `AppIcon` centralizes lucide icons by semantic name.
- `IconButton` is the default for icon-only actions and close buttons.
- `Button` supports `primary`, `secondary`, `outline`, `ghost`, `subtle`, `danger`, `success`, `link`; sizes `sm`, `md`, `lg`; `leftIcon`, `rightIcon`, `icon`, `loading`, `fullWidth`.
- `Input`, `Select`, `Textarea`, `Field`, `Checkbox`, `Switch` cover forms.
- `Badge`, `Card`, `Dialog`, `Dropdown`, `Tabs`, `Table` cover common structure.
- `EmptyState`, `LoadingState`, `Skeleton`, `PageHeader`, `SectionHeader` cover page states and headings.

Use these primitives before adding new local CSS or raw buttons/inputs.

## Audit Snapshot

Initial scan before this pass:

- Inline styles in JS/JSX: 43 occurrences.
- Raw colors in CSS/JSX/JS: 2008 occurrences.
- Arbitrary Tailwind values in JS/JSX: 152 occurrences.
- Manual SVG/unicode icon-like patterns: 89 occurrences.
- Direct `lucide-react` imports: 50 files.
- Native buttons: 262 occurrences.
- Native inputs/selects/textareas: 183 occurrences.

This pass introduced shared primitives and migrated high-traffic shell elements:

- `FormModalShell` close action.
- `MobileSheet` close action.
- `ToastStack` status/close icons.
- `SearchControl` search/clear icons.
- `NotificationDrawer`, `NotificationAlertRow`, and `NotificationAggregateRow`.
- `PageHeader` collapsible affordance.
- `WaitlistFreedSlotDialog` actions.
- `VisitMobileCard` swipe/inline actions and calendar visit/reserved sheet actions.
- `CalendarEntryForm` kind switch, visible form fields, client helper actions, package/certificate quick actions, and submit action.
- `CalendarDayList` empty state and add-visit action.
- `SiteAdminPanel` and `SitePage` save/admin actions.
- `ServicesPage` add action and empty states.
- `RowActionsMenu` trigger and menu icons.
- `EmployeesPage` add actions and empty state.
- `PackagesPage` action icons, archive affordances, and empty states.
- `SupplyForm` fields and submit action.
- Package, certificate, waitlist, employee, service, task, message-template, and financial-operation form controls.
- Core field/button/badge/dialog/dropdown/table primitives.

## Migration Rules

1. Do not change business logic while migrating design.
2. Keep token changes backward compatible.
3. Prefer `AppIcon` over direct `lucide-react` imports in new or touched UI.
4. Prefer `IconButton` for icon-only actions, especially close, more, copy, QR, external link, edit, delete.
5. Prefer `Button` variants over page-local button classes.
6. Prefer `Field + Input/Select/Textarea` for new forms.
7. Use `Tabs/TabButton` for page tabs instead of button-like custom tab markup.
8. Keep cards at `--radius-card`; controls at `--radius-control`.
9. Avoid inline `style={{...}}`; add tokens/classes instead.
10. If a component needs a new size/color, add a token first.

## Remaining Debt

The app still has a lot of page-local UI from older iterations. Recommended next slices:

1. Calendar desktop controls and remaining native calendar utilities.
2. Club page menus, QR/style modals, gift management.
3. Clients detail modal and loyalty card panel.
4. Page tabs across Club, Settings, Statistics.
5. Sidebar/mobile navigation hard-coded colors.
6. Remaining specialized controls such as toggles, color pickers, and hidden form values.

Run after every slice:

```bash
npm run lint
npm run build
npm run test -- --run
```
