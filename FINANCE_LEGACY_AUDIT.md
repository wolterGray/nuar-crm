# Finance Legacy Audit

Date: 2026-07-06

## Source of Truth

- Completed visits: backend transaction endpoints in `backend/routes/crud.js`
  - `POST /api/visits/complete`
  - `POST /api/visits/revert-completed`
  - `POST /api/visits/update-completed`
  - `POST /api/calendar-entries/delete-completed`
- Journal-only package/certificate visits:
  - `POST /api/visits/journal/financial`
  - `PUT /api/visits/journal/:id/financial`
  - `POST /api/visits/journal/:id/delete-financial`
- Certificate sale:
  - `POST /api/certificates/sell`
- Day close:
  - `POST /api/day-close-records/close`
- Payroll period summary and paid mark:
  - `GET /api/payroll/summary`
  - `POST /api/payroll/mark-paid`

## Removed Frontend Dead Helpers

- Removed unused frontend API helpers from `src/api/financial.js`:
  - `createDayCloseRecord`
  - `updateDayCloseRecord`
  - `createPayrollRecord`
  - `updatePayrollRecord`

These helpers were no longer used by active UI after day close and payroll were moved to backend-calculated endpoints.

## Legacy Left For Compatibility

- Backend CRUD routes are still present and intentionally left in place:
  - `POST /api/day-close-records`
  - `PUT /api/day-close-records/:id`
  - `POST /api/payroll-records`
  - `PUT /api/payroll-records/:id`

They are not used by the active frontend save flows anymore. Removing them would be a separate compatibility-breaking backend cleanup step.

These legacy write routes are guarded in `backend/routes/crud.js`:

- Every call writes `console.warn`.
- Every call writes `AuditLog` action `legacy financial write attempted`.
- Writes are rejected with 422 unless the request body explicitly includes `allowLegacyFinancialWrite: true`.
- Normal source-of-truth routes do not need this flag.

## Active Non-Critical CRUD

- `src/hooks/useFinancialOperations.js` still uses `createVisit` / `updateVisit` for ordinary journal operations without package/certificate ledger.
- `src/hooks/useCertificateHandlers.js` still uses `updateCertificate` for editing an existing certificate entity. Certificate sale creation uses `sellCertificate`.
- `src/hooks/useClientHandlers.js` still uses `createClientPackage` / `updateClientPackage` for package sale and manual package edits. This is still an active financial flow and should not be removed silently.
- `src/hooks/useCalendarActions.js` and `src/hooks/usePaymentJournal.js` still use direct `deleteVisit` / `updateVisit` only in non-ledger fallback paths such as ordinary non-completed or ordinary non-package/certificate records.

## Package Sale Check

- Current frontend sale flow: `src/hooks/useClientHandlers.js` -> `createClientPackage`.
- Current backend route: `POST /api/client-packages`.
- This is a single backend request, not a frontend multi-request chain.
- The current schema does not support linking a package sale to a payment journal visit:
  - `Certificate` has `saleVisitId`.
  - `ClientPackage` has no `saleVisitId` or equivalent link.
- Day close and payroll currently count package sales from `ClientPackage.purchaseDate` / `ClientPackage.price`.
- Creating an extra `Visit` payment journal record for package sale without a schema link would double-count package income in day close/payroll.
- No `POST /api/client-packages/sell` endpoint was added in this cleanup pass because there is no unsafe multi-request flow to collapse, and adding a payment journal record safely requires a separate schema/calculation design.

## Follow-Up Candidate

The remaining active financial flow that may deserve a dedicated endpoint is package sale:

- Current frontend flow: `src/hooks/useClientHandlers.js` -> `createClientPackage` / `updateClientPackage`.
- Suggested next endpoint only if the product wants package sales in payment journal: `POST /api/client-packages/sell`.
- Safe scope for that separate stage: add a sale link field to `ClientPackage`, create linked `Visit`, dedupe day close/payroll against the linked sale visit, validate non-negative `price` / `remainingVisits`, calculate status on backend, write `AuditLog`, and then move frontend package sale to the new endpoint.
