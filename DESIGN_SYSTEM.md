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

Initial scan before migration passes:

- Inline styles in JS/JSX: 43 occurrences.
- Raw colors in CSS/JSX/JS: 2008 occurrences.
- Arbitrary Tailwind values in JS/JSX: 152 occurrences.
- Manual SVG/unicode icon-like patterns: 89 occurrences.
- Direct `lucide-react` imports: 50 files.
- Native buttons: 262 occurrences.
- Native inputs/selects/textareas: 183 occurrences.

Current status after design system completion pass:

- Direct `lucide-react` imports: **1 file** (`src/components/ui/AppIcon.jsx` centralized icon wrapper).
- Native `<button>` elements in UI code: **0 application action buttons** (only 4 primitive wrappers + 2 mobile backdrop triggers remain).
- Native `<input>` elements in UI code: **0 application form inputs** (only 3 primitive wrappers + 2 specialized inputs: theme radio picker and hidden file uploader in `SettingsPage.jsx`).
- Inline `style={{` occurrences: **27 occurrences** (strictly limited to dynamic layout math, transforms, progress bar widths, and CSS variable injections).
- Raw hex color definitions: **442 occurrences** (concentrated inside `tokens.css`, `colorThemes.js`, `color-themes.css`, and dynamic palette maps).

This pass introduced shared primitives and completed full migration across shell elements and pages:

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
- New-client form and automated messaging panels for SMS, follow-up, review requests, bulk SMS, and Telegram digest.
- Waitlist panel actions/empty states and the global error boundary.
- Client search dialog input, message action, and icons.
- Payroll and daily-payroll controls, statuses, empty states, and actions.
- Site booking notification settings, request panel actions, and shared hint icons.
- Booksy Gmail sync panel, day-close form controls, and login screen icons/actions.
- Automated SMS, inactive follow-up, review request, Telegram digest, and bulk SMS panel icons/forms.
- TodayPage and OperationsPage task check buttons migrated to `IconButton` primitive.
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

The app design system migration is now structurally complete. Recommended ongoing maintenance:

1. Maintain token usage for new pages and features.
2. Prevent direct `lucide-react` imports outside of `AppIcon.jsx`.
3. Use `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox` for any future UI components.
4. Periodically run the design metrics audit script to catch regression.

Run after every slice:

```bash
npm run lint
npm run build
npm run test -- --run
```
