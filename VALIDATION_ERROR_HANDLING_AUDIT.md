# Validation And Error Handling Audit

Date: 2026-07-06

## Scope

Checked the main backend route files:

- `backend/routes/auth.js`
- `backend/routes/crud.js`
- `backend/routes/functions.js`

No Prisma schema changes and no UI changes were made.

## What Was Checked

| Area | Findings |
| --- | --- |
| Numeric amounts | Critical financial endpoints already have non-negative checks for visits, packages, certificates, day close, payroll, and legacy financial CRUD. Some non-critical catalog/inventory fields still coerce invalid values to `0` with `Number(...) || 0`. |
| Dates | Day close/payroll use normalized date helpers. Some legacy/generic CRUD routes still accept `new Date(value)` directly and can produce invalid dates or Prisma errors. |
| Route ids | Many routes use `Number(req.params.id)`. The most dangerous owner/destructive deletes now validate positive integer ids before calling Prisma. Read/update routes still need a broader follow-up pass. |
| Prisma error exposure | Shared CRUD helpers use `getHttpErrorResponse()`. Unknown 500 errors now return a generic message, while technical details remain in `console.error` / `ErrorEvent`. |
| Error response shape | `/api` mostly uses `{success:false,error}`. `/functions/bulk-sms` previously returned `{success:false,message}` for invalid/action errors; it now returns `{success:false,error}` for failures. |
| User input 400/422 | Newer transaction endpoints generally return 422 via `sendValidationError`. Older routes still mix 400 and 422. |

## Critical Fixes Made

### 1. Destructive route id validation

Added a small helper in `backend/routes/crud.js`:

- `parsePositiveInt(value, fieldName)`
- `getRouteId(req, res, fieldName)`

Applied it to owner/destructive delete endpoints:

- `DELETE /api/calendar-entries/:id`
- `DELETE /api/visits/journal/:id`
- `DELETE /api/clients/:id`
- `DELETE /api/employees/:id`
- `DELETE /api/visits/:id`
- `DELETE /api/client-packages/:id`
- `DELETE /api/certificates/:id`
- `DELETE /api/day-close-records/:id`
- `DELETE /api/payroll-records/:id`

Invalid ids now return 422 before Prisma is called.

### 2. Functions route user-input errors

Updated `backend/routes/functions.js` for `POST /functions/bulk-sms`:

- `action: "test"` now requires `testNumber`.
- `action: "send"` now requires a non-empty `recipients` array.
- invalid `action` now returns 400 with `{success:false,error}`.
- known input errors return 422.
- unexpected failures return a generic 500 message instead of raw internal text.

Audit/ErrorEvent behavior from the previous stage remains intact.

### 3. Raw 500 error leakage

Updated `backend/utils/httpErrors.js`:

- Known Prisma errors still return stable messages:
  - `P2002` -> 409 duplicate value
  - `P2025` -> 404 not found
- Validation/user-input errors still return their readable message for 400/422.
- Unknown errors and explicit 5xx statuses now return generic `Internal Server Error`.

Updated direct catch blocks in `backend/routes/crud.js` that previously returned raw `err.message` as 400:

- `GET /api/visit-state`
- operations state endpoint
- financial state endpoint
- bulk `PUT /api/system-state`

These now go through `getHttpErrorResponse()`, so unexpected backend failures return generic 500 text.

Raw technical messages are still retained internally in:

- `console.error(...)`
- `recordErrorEvent(...)` context/message fields

## Remaining Risks

| Risk | Priority | Suggested follow-up |
| --- | --- | --- |
| Many read/update routes still parse ids with `Number(req.params.id)` without an early positive-int guard | Medium | Extend `getRouteId()` gradually to GET/PUT routes by entity group |
| Older appointment/visit routes use `new Date(scheduledAt)` without validating valid date input | Medium | Add `parseRequiredDate()` / `parseOptionalDate()` helpers and apply to legacy visit routes |
| Catalog/settings numeric fields often coerce invalid numbers to `0` | Medium | Add focused validation per domain instead of changing all builders at once |
| Error shape is still mixed in some older routes | Low | Standardize backend failures on `{success:false,error}` |
| Auth login uses 401 for missing/wrong credentials without separate 400 missing-field validation | Low | Keep current generic behavior to avoid username/password probing signals |

## Notes

This pass intentionally did not mass-edit all route handlers. The backend has many legacy CRUD paths, and broad validation changes could alter existing UI behavior. The safest next step is to move through id/date guards route group by route group.
