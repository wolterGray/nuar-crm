# AuditLog Consistency Audit

Date: 2026-07-06

## Scope

This audit covers backend AuditLog writes and the critical CRM actions that should leave an audit trail:

- auth/login events
- completed visit complete/revert/update/delete
- package and certificate usage
- certificate sale and package sale
- day close
- payroll mark-paid
- employee changes
- client delete
- settings changes
- legacy financial write attempts

No schema changes were made.

## Current AuditLog Format

Audit writes go through `backend/services/loggingService.js`.

Stored fields:

| Field | Source |
| --- | --- |
| `action` | caller-provided string |
| `actorId` | `req.auth.sub`, `req.auth.id`, `req.auth.email`, or `unknown` |
| `entity` | caller-provided entity name |
| `entityId` | caller-provided id converted to string |
| `before` | caller-provided JSON snapshot |
| `after` | caller-provided JSON snapshot or metadata |
| `ip` | `req.ip` or `x-forwarded-for` |
| `userAgent` | request `user-agent` |
| `createdAt` | database default timestamp |

Format notes:

- The schema uses `entity`, not `entityType`.
- The schema uses `actorId`, not a separate `user` or `email` field.
- Actor email is available when JWT/auth middleware provides it; for login events it is stored in `after.email`.
- Audit write failures are intentionally swallowed by `recordAuditLog()` and recorded as `ErrorEvent` with source `audit`.

## Places That Write AuditLog

| Area | Location | Coverage |
| --- | --- | --- |
| Shared CRUD helpers | `backend/routes/crud.js` `respondWithAudit`, `auditCreate`, `auditUpdate`, `auditDelete` | Generic create/update/delete audit with before/after where available |
| Legacy financial write guard | `backend/routes/crud.js` `warnLegacyFinancialWrite` | Logs `legacy financial write attempted` before legacy day close/payroll writes |
| Auth login | `backend/routes/auth.js` | Logs `login success` and `login failed` |
| Completed visit complete | `POST /api/visits/complete` | Logs `complete visit`, `use package`, `use certificate` |
| Completed visit update | `POST /api/visits/update-completed` | Logs `restore package`, `use package`, `restore certificate`, `use certificate`, `update completed visit` |
| Completed visit revert | `POST /api/visits/revert-completed` | Logs package/certificate restore and `revert completed visit` |
| Completed calendar delete | `POST /api/calendar-entries/delete-completed` | Logs package/certificate restore and `delete completed calendar entry` |
| Journal financial create/update/delete | `POST /api/visits/journal/financial`, `PUT /api/visits/journal/:id/financial`, `POST /api/visits/journal/:id/delete-financial` | Logs package/certificate use/restore and journal record changes |
| Certificate sale | `POST /api/certificates/sell` | Logs `sell certificate` and `create certificate sale payment` |
| Package sale | `POST /api/client-packages` | Logs `create package sale` through shared helper |
| Day close source of truth | `POST /api/day-close-records/close` | Logs `create day close` or `update day close` |
| Payroll source of truth | `POST /api/payroll/mark-paid` | Logs `create payroll record` or `update payroll record` |
| Employee changes | `POST/PUT/DELETE /api/employees` | Logs create/update/delete employee through shared helpers |
| Client delete | `DELETE /api/clients/:id` | Logs `delete client` through shared helper |
| Settings changes | `PUT /api/system-state/:key`, `PUT /api/system-state` | Logs `update settings` |

## Critical Coverage Map

| Critical action | Current status | Notes |
| --- | --- | --- |
| Login success | Covered | Added `login success` AuditLog entry in `backend/routes/auth.js` |
| Login failure | Covered | Added `login failed` AuditLog entry without storing password |
| Session verification | Not logged | Intentionally left out for now to avoid noisy logs on routine app loads |
| Completed visit complete | Covered | Includes package/certificate usage logs |
| Completed visit revert | Covered | Includes package/certificate restoration logs |
| Completed visit update | Covered | Includes package/certificate restore/use logs |
| Completed completed-calendar delete | Covered | Includes package/certificate restoration logs |
| Package usage | Covered | Logged in completed visit, update, revert/delete, and journal financial endpoints |
| Certificate usage | Covered | Logged in completed visit, update, revert/delete, and journal financial endpoints |
| Certificate sale | Covered | Dedicated transaction endpoint logs certificate and payment record |
| Package sale | Covered | Single package create flow logs package sale |
| Day close | Covered | Source-of-truth endpoint logs create/update |
| Payroll mark-paid | Covered | Source-of-truth endpoint logs create/update payroll record |
| Employee changes | Covered | Owner-guarded CRUD writes use audit helpers |
| Client delete | Covered | Owner-guarded delete uses audit helper |
| Settings changes | Covered | Owner-guarded system-state writes log settings updates |
| Legacy financial write attempts | Covered | Guard logs before returning 422 or allowing explicit legacy write |

## Format Differences And Risks

| Issue | Risk | Recommendation |
| --- | --- | --- |
| `entity` vs requested `entityType` terminology | Low | Keep schema as-is; document `entity` as canonical field |
| No separate `actorEmail` column | Medium | Keep schema for now; include email in JWT actor or `after` metadata where useful |
| Login failure actor is attempted email | Low | Good enough for single-admin mode; never log password |
| Read access is not audited | Medium | Add only if product needs compliance-style read trails; this can become very noisy |
| Auth session refresh is not audited | Low | Avoid unless investigating suspicious sessions |
| `functions.js` operational endpoints do not use AuditLog | Medium | Add targeted logs later for user-facing destructive/bulk operations if they are active UI flows |

## Remaining Gaps

1. There is no owner-only `GET /api/audit-log` endpoint or frontend AuditLog view.
2. Auth session checks are not logged.
3. Read-only finance/payroll/day-close views are not audited.
4. Some non-financial operational routes in `backend/routes/functions.js` should be reviewed separately for bulk/destructive behavior.
5. Audit action names are human-readable strings, not a strict enum. That is flexible but makes analytics more fragile.

## Minimal Changes Made In This Stage

1. Added `AuditLog` write for successful local admin login.
2. Added `AuditLog` write for failed local admin login attempts.
3. Added this audit report.

