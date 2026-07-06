# Manual Finance Test Checklist

Date: 2026-07-06

Purpose: production-like manual verification of critical NUAR CRM finance flows after moving financial source-of-truth logic to backend transaction endpoints.

Use a staging or copied production-like database whenever possible. Before touching real production data, create a DB backup.

## Preflight

- Confirm backend is running against the intended database.
- Confirm frontend points to the intended backend.
- Log in as owner.
- Create a DB backup:

```bash
npm run db:backup
```

- Keep browser DevTools Network tab open.
- Keep DB access ready for read-only checks:
  - `Visit`
  - `CalendarEntry`
  - `ClientPackage`
  - `ClientPackageUsage`
  - `Certificate`
  - `CertificateUsage`
  - `DayCloseRecord`
  - `PayrollRecord`
  - `AuditLog`

## Scenario Matrix

### 1. Ordinary Completed Visit

Setup:
- Create or choose a scheduled calendar visit for a test client.
- Use payment method cash/card/BLIK without package or certificate.

Action:
- Complete the visit from calendar.

Expected result:
- Frontend calls `POST /api/visits/complete`.
- `CalendarEntry.status = completed`.
- `CalendarEntry.visitId` is set.
- One linked `Visit` exists.
- Repeating the same complete action does not create a duplicate visit.

Balances expected:
- No `ClientPackage.remainingVisits` change.
- No `Certificate.remainingBalance` change.
- No usage ledger rows.

AuditLog expected:
- `complete visit` for entity `Visit`.

Rollback/revert expected:
- Revert should call `POST /api/visits/revert-completed`.
- Linked `Visit` is deleted.
- `CalendarEntry` returns to `scheduled`.

### 2. Package Completed Visit

Setup:
- Create or choose an active client package with `remainingVisits >= 1`.
- Create a scheduled calendar visit for that client.

Action:
- Complete the visit with package payment and `packageSessionsUsed = 1`.

Expected result:
- Frontend calls `POST /api/visits/complete`.
- One linked `Visit` exists.
- One `ClientPackageUsage` exists for `[clientPackageId, visitId]`.
- Repeating complete does not create duplicate usage and does not decrement twice.

Balances expected:
- `ClientPackage.remainingVisits` decreases by `packageSessionsUsed`.
- `remainingVisits` never goes below `0`.

AuditLog expected:
- `complete visit`.
- `use package`.

Rollback/revert expected:
- Revert restores `remainingVisits` by `sessionsUsed`, not above `totalVisits`.
- `ClientPackageUsage.revertedAt` is set.
- Repeating revert is idempotent and does not restore twice.

### 3. Certificate Completed Visit

Setup:
- Create or choose an active certificate with `remainingBalance >= certificateAmountUsed`.
- Create a scheduled calendar visit.

Action:
- Complete the visit with certificate payment.

Expected result:
- Frontend calls `POST /api/visits/complete`.
- One linked `Visit` exists.
- One `CertificateUsage` exists for `[certificateId, visitId]`.
- Repeating complete does not create duplicate usage and does not decrement twice.

Balances expected:
- `Certificate.remainingBalance` decreases by `certificateAmountUsed`.
- `remainingBalance` never goes below `0`.
- Certificate status/used date updates according to balance.

AuditLog expected:
- `complete visit`.
- `use certificate`.

Rollback/revert expected:
- Revert restores `remainingBalance` by usage amount, not above `nominal`.
- `CertificateUsage.revertedAt` is set.
- Certificate status/used date are recalculated.

### 4. Mixed Package + Certificate Completed Visit

Setup:
- Active client package with enough visits.
- Active certificate with enough balance.
- Scheduled calendar visit.

Action:
- Complete using both package and certificate.

Expected result:
- Frontend calls `POST /api/visits/complete`.
- One linked `Visit` exists.
- One active `ClientPackageUsage` exists.
- One active `CertificateUsage` exists.
- Partial ledger state must not appear.
- Repeating complete returns idempotent success if both ledgers already exist.

Balances expected:
- Package visits decrease once.
- Certificate balance decreases once.
- Neither balance goes below zero.

AuditLog expected:
- `complete visit`.
- `use package`.
- `use certificate`.

Rollback/revert expected:
- Revert restores both package and certificate in one backend transaction.
- Both usages get `revertedAt`.
- Repeating revert does not restore twice.

### 5. Revert Completed Visit

Setup:
- Have completed ordinary, package, certificate, and mixed test visits available.

Action:
- Use the calendar/payment UI action that unlinks/reverts completed visit.

Expected result:
- Ordinary/package/certificate/mixed completed visits call `POST /api/visits/revert-completed`.
- `CalendarEntry.status = scheduled`.
- `CalendarEntry.visitId = null`.
- Linked `Visit` is deleted.

Balances expected:
- Ordinary: no balance change.
- Package: package restored once.
- Certificate: certificate restored once.
- Mixed: both restored once.

AuditLog expected:
- `revert completed visit`.
- `restore package` when package was used.
- `restore certificate` when certificate was used.

Rollback/revert expected:
- Repeating the same revert request returns idempotent success and no extra balance changes.

### 6. Delete Completed Calendar Entry

Setup:
- Have completed ordinary, package, certificate, and mixed calendar entries.

Action:
- Delete the completed calendar entry from calendar UI.

Expected result:
- Package/certificate/mixed completed visits call `POST /api/calendar-entries/delete-completed`.
- `CalendarEntry` is deleted.
- Linked `Visit` is deleted.
- Ordinary completed visits may remain on old safe flow if that is current UI behavior; verify no duplicate deletes.

Balances expected:
- Package restored once.
- Certificate restored once.
- Mixed restores both once.

AuditLog expected:
- `delete completed calendar entry`.
- `restore package` if package used.
- `restore certificate` if certificate used.

Rollback/revert expected:
- If accidentally deleted in staging, restore from backup or recreate test data manually.
- Repeating backend request with same ids should be idempotent when entry is already gone.

### 7. Update Completed Visit

Setup:
- Have completed visits for ordinary, package, certificate, and mixed cases.
- Prepare new payment data:
  - ordinary -> package
  - package -> ordinary
  - certificate -> ordinary
  - mixed -> ordinary
  - ordinary -> mixed
  - package/certificate/mixed amount/session changes

Action:
- Edit the completed visit from calendar/payment journal UI.

Expected result:
- Frontend calls `POST /api/visits/update-completed`.
- Existing `Visit` is updated, not duplicated.
- Linked `CalendarEntry` remains completed and points to the same visit.

Balances expected:
- Old active package/certificate usages are restored once via `revertedAt`.
- New package/certificate usages are applied once.
- Mixed transitions restore/apply both ledgers atomically.
- No partial ledger state.

AuditLog expected:
- `update completed visit`.
- `restore package` / `use package` when package side changes.
- `restore certificate` / `use certificate` when certificate side changes.

Rollback/revert expected:
- Revert after update should restore the currently active usage state only once.

### 8. Journal-Only Package/Certificate Edit/Delete

Setup:
- Create journal-only payment records without `calendarEntryId`:
  - package-only
  - certificate-only
  - mixed package+certificate if supported by current journal UI

Action:
- Edit the journal payment.
- Delete the journal payment.

Expected result:
- Frontend uses journal financial endpoints:
  - `POST /api/visits/journal/financial`
  - `PUT /api/visits/journal/:id/financial`
  - `POST /api/visits/journal/:id/delete-financial`
- No direct frontend balance mutation.

Balances expected:
- Edit restores old ledger and applies new ledger once.
- Delete restores active ledger once.
- Repeating delete does not restore twice.

AuditLog expected:
- Journal financial create/update/delete action.
- `use package` / `restore package` where relevant.
- `use certificate` / `restore certificate` where relevant.

Rollback/revert expected:
- After delete, manually recreate test journal record if needed.

### 9. Certificate Sale

Setup:
- Choose a test client and certificate nominal value.

Action:
- Sell certificate through UI.

Expected result:
- Frontend calls `POST /api/certificates/sell`.
- `Certificate` is created.
- Sale `Visit` / payment journal record is created if current sale flow expects it.
- Certificate is linked to sale visit via `saleVisitId`.

Balances expected:
- `Certificate.nominal >= 0`.
- `Certificate.remainingBalance = nominal` initially.
- No usage decrement happens on sale.

AuditLog expected:
- `sell certificate`.
- `create certificate sale payment`.

Rollback/revert expected:
- In staging, delete sale artifacts manually only after recording ids.
- In production, restore from backup if sale was accidental and cannot be cleanly reversed.

### 10. Package Sale

Setup:
- Choose a test client and package definition.

Action:
- Sell/create client package through UI.

Expected result:
- Current flow creates `ClientPackage` through `POST /api/client-packages`.
- No extra sale `Visit` should be created unless schema/business flow changes later.

Balances expected:
- `remainingVisits >= 0`.
- `price >= 0`.
- `remainingVisits` matches package sale setup.

AuditLog expected:
- `create package sale`.

Rollback/revert expected:
- Deleting a test package sale should be owner-guarded.
- Verify delete does not affect unrelated visits/usages.

### 11. Day Close

Setup:
- Have completed visits, package sales, certificate sales, tips, expenses/operations for a selected test date.
- Ensure expected totals are known.

Action:
- Close day from UI.

Expected result:
- Frontend calls `POST /api/day-close-records/close`.
- Backend calculates totals.
- `DayCloseRecord` is created or updated for the date.

Balances expected:
- No package/certificate balances change during day close.
- Totals match backend-calculated journal:
  - total
  - cash
  - card
  - BLIK
  - packages
  - certificates
  - expenses/profit fields shown in UI

AuditLog expected:
- `create day close` or `update day close`.

Rollback/revert expected:
- Re-closing the same date updates existing record.
- Delete day close record only as owner and only in staging/manual test.

### 12. Payroll Summary

Setup:
- Have completed visits and package/certificate sales for a payroll period.
- Have employee commission rules configured.

Action:
- Open payroll for a date range and optional employee.

Expected result:
- Frontend calls `GET /api/payroll/summary`.
- Backend returns readonly report.
- No `PayrollRecord` is created by viewing summary.

Balances expected:
- No package/certificate balances change.
- `totalPayout >= 0`.

AuditLog expected:
- No write AuditLog expected for readonly summary unless read auditing is added later.

Rollback/revert expected:
- Not applicable.

### 13. Payroll Mark-Paid

Setup:
- Use the same payroll period from the summary test.

Action:
- Mark payroll paid.

Expected result:
- Frontend calls `POST /api/payroll/mark-paid`.
- `PayrollRecord` is created or updated.
- Repeating mark-paid for same period updates the existing period record, not duplicate by period key.

Balances expected:
- No package/certificate balances change.
- `PayrollRecord.amount >= 0`.
- `report.totals.totalPayout >= 0`.

AuditLog expected:
- `create payroll record` or `update payroll record`.

Rollback/revert expected:
- Owner can delete/reopen payroll record if UI supports it.
- Verify deletion is owner-guarded.

### 14. Legacy Financial CRUD Guard

Setup:
- Use an API client with owner token.
- Target legacy endpoints:
  - `POST /api/day-close-records`
  - `PUT /api/day-close-records/:id`
  - `POST /api/payroll-records`
  - `PUT /api/payroll-records/:id`

Action:
- Call without `allowLegacyFinancialWrite: true`.
- Then call in staging only with `allowLegacyFinancialWrite: true` if needed.

Expected result:
- Without flag: 422 and no financial write.
- With explicit flag: endpoint may write legacy record.

Balances expected:
- No package/certificate balances change.

AuditLog expected:
- `legacy financial write attempted` for each call.
- If allowed, normal create/update audit also appears.

Rollback/revert expected:
- Delete any staging-only legacy records created during test.

### 15. RBAC Owner Guard

Setup:
- Obtain an owner token and a non-owner/authenticated token if available.

Action:
- Call owner-protected endpoints with non-owner token:
  - payroll summary
  - payroll mark-paid
  - day close close
  - destructive delete endpoints
  - employees/settings writes
  - functions routes

Expected result:
- Owner token succeeds when payload is valid.
- Non-owner token returns 403 `Owner role required`.

Balances expected:
- Rejected requests do not change balances or records.

AuditLog expected:
- No domain AuditLog for rejected requests unless auth/RBAC denial auditing is added later.

Rollback/revert expected:
- Not applicable for rejected calls.

### 16. Backup Before/After Financial Operations

Setup:
- Use staging or production-like DB.
- Ensure `pg_dump` is available.

Action:
- Run backup before finance regression:

```bash
npm run db:backup
```

- Run selected financial operations.
- Run backup after finance regression:

```bash
npm run db:backup
```

Expected result:
- Two dump files exist in `backend/backups` or configured `BACKUP_DIR`.
- Dumps are non-empty.
- No restore is run automatically.

Balances expected:
- Balances match scenario expectations between before/after.

AuditLog expected:
- Backup command itself does not write AuditLog.
- Financial operations inside the test write their normal AuditLog entries.

Rollback/revert expected:
- If regression corrupts staging data, restore from the pre-test dump using `BACKUP_RESTORE_STRATEGY.md`.

## 30-40 Minute Smoke Order

1. Preflight backup.
2. Ordinary completed visit.
3. Package completed visit.
4. Certificate completed visit.
5. Mixed package+certificate completed visit.
6. Revert one package/certificate/mixed completed visit.
7. Delete one completed package/certificate calendar entry.
8. Update one completed visit ordinary -> package or certificate.
9. Certificate sale.
10. Package sale.
11. Day close for the test date.
12. Payroll summary for the test period.
13. Payroll mark-paid for the test period.
14. Legacy financial CRUD guard without `allowLegacyFinancialWrite`.
15. RBAC owner guard spot-check on one destructive endpoint.
16. Post-test backup.

Pass criteria:
- No duplicate visits/usages.
- No balance below zero.
- No partial mixed ledger state.
- AuditLog entries exist for all write flows.
- Backend returns 403/422 where expected.

## 2-3 Hour Full Regression Order

1. Preflight backup and note dump filename.
2. Run all four complete scenarios:
   - ordinary
   - package
   - certificate
   - mixed
3. Repeat each complete request/action once to verify idempotency.
4. Run revert for all four scenarios.
5. Repeat each revert request/action once.
6. Run delete completed calendar entry for package, certificate, and mixed.
7. Run update completed visit transitions:
   - ordinary -> ordinary
   - ordinary -> package
   - package -> ordinary
   - package A -> package B
   - ordinary -> certificate
   - certificate -> ordinary
   - certificate A -> certificate B
   - ordinary -> mixed
   - mixed -> ordinary
   - mixed -> package
   - mixed -> certificate
   - mixed -> mixed
8. For each update transition, verify old usage `revertedAt`, new active usage, balances, and AuditLog.
9. Run journal-only package/certificate create, edit, delete.
10. Sell certificate and verify sale payment link.
11. Sell package and verify no double-counting payment journal record is created.
12. Close day and compare totals with visible journal/payment rows.
13. Re-close same day and verify update, not duplicate.
14. Open payroll summary for full period and for one employee.
15. Mark payroll paid and repeat mark-paid for same period.
16. Test legacy financial CRUD guard without and with explicit flag in staging only.
17. Test RBAC owner guard on payroll, day close, employees, settings, destructive delete, and functions.
18. Run post-test backup.
19. Review AuditLog for all expected action names.
20. Review ErrorEvent for unexpected failures.
21. If needed, restore staging from the preflight dump and rerun smoke.

Full regression pass criteria:
- Every scenario has expected record state.
- Every balance change is explainable by active ledger rows.
- Every reverted usage has `revertedAt`.
- No duplicate `[clientPackageId, visitId]` or `[certificateId, visitId]` active usage.
- All critical writes are represented in AuditLog.
- No unexpected ErrorEvent entries.

