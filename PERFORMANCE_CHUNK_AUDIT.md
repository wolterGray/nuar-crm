# Performance / Chunk Audit

Date: 2026-07-06

## Current Build Warning

Vite/Rolldown previously warned that at least one JavaScript chunk was larger than 500 kB after minification.

Last observed build output after route lazy-loading:

| Chunk | Size | Notes |
| --- | ---: | --- |
| `index-*.js` | ~398.78 kB | Main app entry; now below the 500 kB warning threshold |
| `vendor-xlsx*.js` | ~424.85 kB | Excel export library; async and loaded only after export click |
| `vendor-Box*.js` | ~388 kB | General vendor bucket from dependencies not manually split |
| `vendor-recharts*.js` | ~202 kB | Statistics charts |
| `vendor-supabase*.js` | ~195 kB | Supabase client and auth/site legacy utilities |
| `vendor-react-dom*.js` | ~175 kB | React DOM |
| `index-*.css` | ~375 kB | Large stylesheet, not the JS chunk warning source |

## Main Cause

The warning was primarily caused by the main application entry chunk, not by a single vendor package.

Key contributors:

- `src/App.jsx` is large: about 2,220 lines.
- `App.jsx` imports and wires many stateful hooks, modal handlers, persistence utilities, backend API loaders, and cross-page state.
- Several high-fanout components are still eagerly imported because they are part of the shell or modals rather than lazy pages.
- Route-level lazy loading now covers all top-level pages in `AppRoutes.jsx`; the shell/state layer remains broad but no longer crosses the warning threshold.

## Current Lazy Loading

Lazy-loaded in `src/components/AppRoutes.jsx`:

- `TodayPage`
- `CalendarPage`
- `ClientsPage`
- `ServicesPage`
- `PackagesPage`
- `EmployeesPage`
- `MessageTemplatesPage`
- `OperationsPage`
- `ImportPage`
- `PaymentsPage`
- `StatisticsPage`
- `SitePage`
- `SettingsPage`

The remaining eager code is mostly app shell, state wiring, shared modals, navigation, notifications, and shared utilities.

## Heavy Imports

| Dependency | Where used | Current status | Risk / opportunity |
| --- | --- | --- | --- |
| `xlsx` | `src/utils/exportExcel.js`, called from `StatisticsPage` | Changed to dynamic import | Safe because it is only needed after clicking Excel export |
| `recharts` | `StatisticsPage` | Isolated in lazy `StatisticsPage` and `vendor-recharts` | Acceptable for now; avoid importing charts into shell |
| `@tanstack/react-table` | `VisitsTable` | Used by payments/journal table | Consider lazy-loading heavy table views if main entry stays large |
| `@dnd-kit/core` | `CalendarPage`, `OperationsPage` | Isolated in `vendor-dnd-kit`; pages are lazy | Good current split |
| `framer-motion` | Toasts, notification drawer, some pages/cards | Partially shell-level due toast/drawer | Main-entry contributor because toast/drawer are always mounted |
| `lucide-react` | Many components | Separate `vendor-lucide`; many eager icon imports | Acceptable size, but broad use keeps icon vendor commonly loaded |
| `@supabase/supabase-js` | `src/lib/supabase.js`, auth/site/legacy utilities | Separate `vendor-supabase`; still likely loaded early | Review old Supabase paths after backend auth migration |
| `date-fns` | date utilities, reminders, Booksy import display | Separate `vendor-date-fns` | Fine, but central date utils make it common |

## App.jsx Size / Shape

`src/App.jsx` currently acts as:

- auth/session gate wiring;
- backend hydration coordinator;
- local persistence coordinator;
- all top-level CRM collection state owner;
- modal state owner;
- route prop composer;
- finance/calendar/client/package/certificate handler coordinator;
- integration/automation hook owner.

This makes the main chunk hard to shrink with one safe edit. Large reductions require extracting state domains or deferring modal/feature bundles.

## Safe Split / Lazy Options

Recommended low-risk order:

1. Lazy-load rarely used modal forms in `AppModals.jsx`:
   - package form
   - certificate form
   - employee form
   - import/backup confirmation pieces
2. Move Excel export to action-time dynamic import.
   - Done in this pass.
3. Review Supabase legacy imports:
   - keep site/admin SSO where needed;
   - avoid loading Supabase client on purely local-admin/backend-only paths if possible.
4. Split `App.jsx` by state domains only after route/modal lazy passes:
   - finance state provider;
   - calendar state provider;
   - clients/assets state provider;
   - automation state provider.
5. Consider CSS splitting later. The CSS is large, but current warning was JS chunk size, not CSS.

## Changes Made

1. Changed `src/utils/exportExcel.js` to import `xlsx` dynamically:

```js
const XLSX = await import("xlsx");
```

2. Changed `StatisticsPage` export handler to `async` and `await exportRowsToExcel(...)`.

3. Converted the remaining non-key eager pages in `src/components/AppRoutes.jsx` to `React.lazy`:

- `TodayPage`
- `ServicesPage`
- `PackagesPage`
- `EmployeesPage`
- `MessageTemplatesPage`
- `ImportPage`
- `SitePage`

Each route uses the existing `PageSuspense` fallback.

Why safe:

- Excel export is user-triggered.
- No finance/business logic changes.
- No UI state shape changes.
- If export is never used, `xlsx` does not need to load for the statistics page render.

Post-change result:

- `vendor-xlsx` is still large, but it is now an async action chunk.
- `index-*.js` dropped from ~501.37 kB to ~398.78 kB.
- The Vite chunk warning is gone in the latest build.
- Further reductions should target modal-level lazy loading and shell/state decomposition.

## What Not To Do Yet

- Do not refactor all of `App.jsx` in one pass.
- Do not remove manualChunks without measuring.
- Do not replace chart/table libraries during audit work.
- Do not raise `build.chunkSizeWarningLimit` just to hide the warning.

## Next Safest Stage

The next safest performance stage is modal-level lazy loading in `src/components/AppModals.jsx`.

Suggested scope:

- Change only `AppModals.jsx` and the directly affected form imports if needed.
- Lazy-load rarely opened forms and backup/import preview pieces.
- Run `npm test` and `npm run build`.
- Compare `dist/assets/index-*.js` before/after.

Expected impact:

- Main `index` chunk can shrink further.
- Modal first-open may show a short loader unless forms are preloaded on intent.
