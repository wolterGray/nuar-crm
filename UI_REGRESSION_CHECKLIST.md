# UI Regression Checklist

Date: 2026-07-06

Purpose: manual UI regression pass for NUAR CRM after backend transaction, RBAC, AuditLog, validation, backup, and finance hardening stages.

Use staging or production-like data. Do not run destructive actions in production unless this is an approved maintenance/test window.

## General Preflight

- Open DevTools Console and Network.
- Confirm no red runtime errors on initial load.
- Confirm backend health is green if visible through deployment tools.
- Confirm user is logged in as owner for owner-only actions.
- Before finance-heavy tests, run DB backup if using production-like data:

```bash
npm run db:backup
```

## Screens And Flows

### 1. Login

What to open:
- Open CRM in a fresh/private browser session.
- Also test after clearing local auth storage.

Visual checks:
- Login form is centered and readable.
- Inputs, submit button, loading/disabled state, and error state fit on mobile and desktop.
- No Google login button is shown if local-admin mode hides it.

Actions:
- Submit empty credentials.
- Submit wrong credentials.
- Submit valid owner credentials.
- Refresh after login.

Errors / edge cases:
- Wrong credentials show clear failure and do not enter CRM.
- Backend unavailable shows a non-crashing error state.
- Expired/rejected token returns user to login.

Data after refresh:
- Auth session remains valid.
- Active page can load backend data after refresh.

### 2. Today Dashboard

What to open:
- Open default/today page.

Visual checks:
- Alerts, today visits, tasks, supplies, and quick navigation fit without overlap.
- Empty states are readable when there are no visits/tasks.

Actions:
- Open calendar from a today visit.
- Complete or edit a visit via today quick action if available.
- Add task/visit from dashboard action.

Errors / edge cases:
- No clients/visits does not blank the page.
- Long client/service names wrap or truncate cleanly.

Data after refresh:
- Created task/visit remains.
- Dismissed or completed state remains if saved.

### 3. Calendar

What to open:
- Navigate to Calendar.
- Test day with many visits and day with none.

Visual checks:
- Grid/list views render correctly.
- Time slots, visit cards, colors, status badges, action menus, and current day controls are aligned.
- Conflict warnings and confirmation dialogs do not cover critical controls.

Actions:
- Create scheduled visit.
- Move visit to another time.
- Change status.
- Open action menu.
- Delete/cancel scheduled visit.

Errors / edge cases:
- Overlapping visits show conflict handling.
- Long service/client names do not break card size.
- Mobile list/grid toggle works.
- Network error during save leaves local state understandable and shows notification.

Data after refresh:
- New/moved/deleted scheduled entries persist.
- Selected date and visible entries reload from backend consistently.

### 4. Complete Visit Modal / Flow

What to open:
- Calendar visit action for completing scheduled visit.

Visual checks:
- Payment fields, package selector, certificate selector, amount fields, and buttons fit in modal.
- Validation messages are readable.
- Submit button loading state is visible.

Actions:
- Complete ordinary payment.
- Complete package payment.
- Complete certificate payment.
- Complete mixed package + certificate payment.
- Try invalid negative values if UI allows typing.

Errors / edge cases:
- Backend 422 shows user-facing notification.
- Double-click submit does not duplicate visit.
- Package/certificate options update after completion.

Data after refresh:
- Completed visit remains completed.
- Payment journal row exists.
- Package/certificate balances stay changed exactly once.

### 5. Edit Completed Visit

What to open:
- Open completed visit from calendar and payment journal.

Visual checks:
- Existing values are prefilled.
- Package/certificate/mixed fields appear consistently with payment type.
- Save/cancel controls are visible at all viewport sizes.

Actions:
- Edit ordinary -> ordinary.
- Edit ordinary -> package.
- Edit package -> certificate.
- Edit certificate -> mixed.
- Edit mixed -> ordinary.

Errors / edge cases:
- Backend validation errors do not close modal silently.
- Unsupported/incomplete form state does not partially update frontend.
- Long notes do not overflow.

Data after refresh:
- Edited `Visit` and completed `CalendarEntry` remain in sync.
- Old package/certificate balances are restored and new ones applied exactly once.

### 6. Payment Journal

What to open:
- Navigate to Payments.
- Test date filters and master filters.

Visual checks:
- Journal table/cards fit on mobile and desktop.
- Action menu opens near row without clipping.
- Day close panel/history is visible and readable.

Actions:
- Add ordinary journal payment.
- Add journal-only package/certificate payment if UI supports it.
- Edit payment.
- Delete payment.
- Filter by date/master/payment type.

Errors / edge cases:
- Delete confirmation cannot be triggered accidentally.
- Journal-only ledger edit/delete updates balances once.
- Empty filters show clear empty state.

Data after refresh:
- Added/edited/deleted journal rows persist.
- Package/certificate balances remain synced.
- Filters reset or persist according to current UI behavior, but data must not disappear.

### 7. Clients

What to open:
- Navigate to Clients.
- Open list and client detail/drawer.

Visual checks:
- Search, add button, table headers, mobile cards, and client detail panel fit.
- Client assets block shows packages/certificates clearly.
- Duplicate/quality alerts do not overlap table content.

Actions:
- Create client.
- Edit client.
- Add visit from client.
- Update client note.
- Delete/archive client as owner in staging.

Errors / edge cases:
- Missing name validation is visible.
- Duplicate phone/name warnings remain usable.
- Long notes and tags do not break layout.

Data after refresh:
- Client profile and note persist.
- Client visits/assets remain visible.

### 8. Packages And Certificates

What to open:
- Navigate to Packages page.
- Check package catalog, sold client packages, certificates, sales summaries.

Visual checks:
- Package cards/tables and certificate sections align.
- Sale/edit/delete buttons are visible and distinguishable.
- Balances and statuses are readable.

Actions:
- Create/edit/delete package definition in staging.
- Sell package.
- Edit sold client package.
- Sell certificate.
- Edit certificate.
- Delete package/certificate in staging as owner.

Errors / edge cases:
- Negative price/remaining values are rejected by backend.
- Certificate sale failure does not create partial UI state.
- Package sale does not create unexpected payment journal duplicate.

Data after refresh:
- Sold package/certificate persists.
- Certificate sale link and balances persist.
- Deleted staging artifacts remain deleted.

### 9. Day Close

What to open:
- Payments page day close section.
- Choose date with ordinary/package/certificate/mixed payments.

Visual checks:
- Totals cards and close form fit.
- Actual cash, withdrawal, difference, notes, and history are readable.

Actions:
- Close day.
- Re-close same day with changed note/cash.
- Reopen/delete day close record in staging if UI supports it.

Errors / edge cases:
- Negative actual cash/withdrawal is rejected.
- Backend error does not overwrite visible journal.
- Existing day close updates instead of duplicating.

Data after refresh:
- Day close record persists.
- Backend-calculated totals remain same after refresh.

### 10. Payroll

What to open:
- Employees/Masters page payroll panel.
- Test monthly and daily payroll panels if both are visible.

Visual checks:
- Period selector, employee selector, totals, payout table, and mark-paid button fit.
- Paid/open statuses are clear.

Actions:
- Load payroll summary for period.
- Filter by employee if UI supports it.
- Mark payroll paid.
- Reopen/delete payroll record in staging if UI supports it.

Errors / edge cases:
- Empty period shows empty state.
- Backend 403/422 appears as notification, not blank page.
- Repeating mark-paid does not show duplicate paid records.

Data after refresh:
- Paid payroll record remains.
- Summary totals remain backend-consistent.

### 11. Employees / Masters

What to open:
- Navigate to Masters/Employees.

Visual checks:
- Employee cards/table, stats, payroll controls, and edit buttons fit.
- Inactive/archived employees are visually distinct if supported.

Actions:
- Create employee.
- Edit employee commission/payroll settings.
- Delete employee in staging as owner.

Errors / edge cases:
- Missing name validation.
- Commission edge values display correctly.
- Non-owner token cannot write/delete.

Data after refresh:
- Employee changes persist.
- Payroll settings remain.

### 12. Settings

What to open:
- Navigate to Settings.

Visual checks:
- Sections are scannable on desktop and collapsible/usable on mobile.
- Toggles, numeric inputs, text fields, and action buttons do not overlap.
- Cloud sync status and integration status panels are readable.

Actions:
- Change harmless setting such as compact mode/theme/sidebar visibility.
- Save settings.
- Export frontend JSON backup.
- Import invalid backup file.
- Reset settings only in staging.

Errors / edge cases:
- Invalid backup shows validation message.
- Backend settings save failure does not lose current UI state.
- Owner-only setting writes return 403 for non-owner token.

Data after refresh:
- Saved settings persist.
- Export/import modals close cleanly and do not corrupt data.

### 13. Functions / Automation Actions

What to open:
- Settings automation panels:
  - SMS reminders
  - Review requests
  - Telegram digest
- Templates page Bulk SMS panel.
- Site page owner notification / booking panels if visible.
- Import page Booksy/Gmail sync if configured.

Visual checks:
- Status indicators, preview cards, test buttons, and disabled states are clear.
- Buttons show loading/disabled state while request is running.

Actions:
- Refresh status for each integration.
- Run preview where available.
- Send test only in staging or to controlled test recipient/chat.
- Try action with integration disabled/unconfigured.

Errors / edge cases:
- 403 from owner guard is visible.
- Unconfigured env shows clear disabled/error state.
- Bulk SMS preview count matches recipient list.

Data after refresh:
- Last-run/status fields persist only where the app intentionally saves them.
- Message templates used by bulk SMS remain unchanged unless edited.

### 14. Operations

What to open:
- Navigate to Operations.

Visual checks:
- Tasks, supplies, waitlist, quick notes, and action menus fit.
- Drag/reorder UI is usable if enabled.

Actions:
- Add/edit/complete/delete task.
- Add/edit/delete waitlist entry.
- Book waitlist entry into calendar.
- Add/edit supply and change stock.

Errors / edge cases:
- Empty sections show clear empty state.
- Stock changes do not go visually negative unless explicitly allowed.
- Waitlist booking updates calendar and removes/updates waitlist consistently.

Data after refresh:
- Tasks/supplies/waitlist changes persist.
- Calendar entry created from waitlist remains.

### 15. Site / Import / Statistics

What to open:
- Site page.
- Import page.
- Statistics page.

Visual checks:
- Site admin/open buttons and booking request cards fit.
- Import document list and Booksy/Gmail sync panels fit.
- Statistics charts/cards/tables render without overlap.

Actions:
- Open site admin button in staging-safe way.
- Refresh/import preview in Import if configured.
- Change statistics filters and export report.

Errors / edge cases:
- Missing Supabase/Gmail config shows non-crashing message.
- Charts handle empty data.
- Export action works with current filters.

Data after refresh:
- Site settings persist.
- Imported document list persists if saved.
- Statistics data reloads from backend state.

## Mobile / Tablet / Desktop Smoke Pass

Run the same user on three viewport classes:

- Mobile: 375 x 812
- Tablet: 768 x 1024
- Desktop: 1440 x 900 or larger

For each viewport:

1. Login.
2. Navigate through Today, Calendar, Payments, Clients, Packages, Masters, Settings.
3. Open and close main modals:
   - calendar entry
   - complete visit
   - edit completed visit
   - client form
   - package/certificate form
   - employee form
4. Verify no horizontal page scroll unless intentionally used for tables.
5. Verify sticky headers/footers do not cover submit buttons.
6. Verify action menus are reachable and not clipped.
7. Refresh page and confirm current section reloads without blank screen.

Pass criteria:

- No overlapping controls.
- No clipped primary action buttons.
- Text remains readable.
- Modals can be closed.
- Data still appears after refresh.

## Known Risks

### Large Chunk Warning

`npm run build` currently reports a Vite warning for chunks larger than 500 kB. This is not a functional failure, but it increases risk of slower first load and slower mobile parse time.

Suggested later work:

- split more route-level chunks;
- lazy-load heavy analytics/xlsx/recharts paths;
- monitor production load time on mobile.

### Big `App.jsx`

`src/App.jsx` owns much of app state orchestration, hydration, modals, and route wiring. Regression risk is higher when changing cross-cutting state or passing setters.

Suggested later work:

- extract route state providers gradually;
- avoid broad refactors during finance/security work;
- add focused integration tests for state refresh after transaction endpoints.

### Frontend State Sync After Backend Transaction Endpoints

Many finance actions now depend on backend transaction responses updating several local collections at once:

- `visits`
- `calendarEntries`
- `clientPackages`
- `certificates`
- `dayCloseRecords`
- `payrollRecords`

Regression signs:

- UI shows stale package/certificate balance until refresh.
- Duplicate visit appears in payment journal.
- Calendar entry completed state differs from payment journal.
- Delete/revert looks successful but row returns after refresh.

Manual check:

- After every complete/revert/delete/update finance flow, verify immediate UI state and then refresh to confirm backend state matches.

## 30 Minute UI Smoke Order

1. Login.
2. Calendar: create scheduled visit, open edit modal, close modal.
3. Complete one ordinary visit.
4. Payments: verify journal row, edit row, delete/revert only in staging.
5. Clients: create/edit test client and open client detail.
6. Packages: sell package or open sale modal, cancel if production.
7. Certificates: sell certificate or open sale modal, cancel if production.
8. Day close: open panel and close staging date if safe.
9. Payroll: open summary and mark paid only in staging.
10. Settings: save harmless visual setting and refresh.
11. Templates/automation: refresh status or preview, avoid real sends in production.
12. Mobile viewport: repeat navigation through Calendar, Payments, Clients, Settings.

## 2-3 Hour UI Regression Order

1. Run desktop pass for every screen listed above.
2. Run mobile pass for Login, Calendar, Complete Visit, Payments, Clients, Packages, Settings.
3. Run tablet pass for Calendar, Payments, Payroll, Settings.
4. Exercise all critical finance UI actions from `MANUAL_FINANCE_TEST_CHECKLIST.md`.
5. For every backend transaction flow, verify immediate UI state and post-refresh state.
6. Test owner-only UI actions with owner and non-owner token if available.
7. Test integration/action panels in configured and unconfigured states.
8. Export frontend JSON backup from Settings.
9. Review Console and Network for uncaught errors.
10. Record screenshots of any visual overlap, clipped modal, stale state, or confusing error message.

