# FULL GLOBAL APP AUDIT

Date: 2026-07-06

Status: audit/report only. No business logic, schema, UI, or refactor changes were made in this stage.

Overall health score: **82 / 100**

Global status: **ready for staged production smoke**, with controlled medium/high follow-ups documented below.

## Executive Summary

NUAR CRM is now in a substantially safer state than the original frontend-driven financial design. Critical financial flows have been moved to backend transaction/source-of-truth endpoints, mixed package+certificate flows are covered, owner RBAC exists for the most sensitive backend routes, AuditLog/ErrorEvent foundations are in place, raw 500 leakage is hardened, backup/restore documentation exists, and the main Vite chunk warning has been resolved.

The main remaining risks are not in the already-migrated financial transaction endpoints. They are concentrated in broad legacy CRUD, coarse RBAC, large frontend state ownership in `App.jsx`, package sale modeling limits, and missing integration/e2e coverage around backend transaction endpoints.

## Scope Checked

Checked areas:

- Project structure: frontend, backend, Prisma, scripts, docs, env examples, deploy docs.
- Frontend architecture: `App.jsx`, `AppRoutes.jsx`, hooks, API layer, pages, utils, state, storage, loading/error states, lazy loading, dead-code indicators.
- Backend architecture: `server.js`, `auth.js`, `crud.js`, `functions.js`, middleware, utilities, RBAC, AuditLog, ErrorEvent, validation/error handling.
- Database/Prisma: schema, migrations, relations, nullable fields, delete behavior, finance ledger, payroll/day close.
- Finance re-check: all source-of-truth endpoints listed in this task.
- Integrations: SMS, Telegram, owner notifications, review requests, Booksy stub, backup script, Excel export/import.
- Security: auth/session, JWT role owner, requireOwner coverage, public endpoints, legacy endpoints, CORS, env secrets, raw 500 leakage, destructive endpoints.
- Testing: existing test coverage, missing tests, manual checklists, smoke/regression risks.
- Performance: chunk sizes, lazy pages, App size, heavy imports, state sync risks.
- Documentation: audit docs, production checklist, backup/restore, manual finance and UI checklists.

## 1. Project Structure Result

Result: **healthy, with legacy density**

Observed structure:

- Frontend React/Vite app under `src/`.
- Backend Express/Prisma app under `backend/`.
- Prisma schema and migrations under `backend/prisma/`.
- Backend scripts under `backend/scripts/`, including DB backup.
- Audit/deploy/checklist docs at repo root.
- Env examples exist:
  - `.env.example`
  - `backend/.env.example`
  - `backend/.env.production.example`
- Deploy docs exist:
  - `DEPLOY_HETZNER.md`
  - `README_DEPLOY_WINDOWS.md`
  - `PRODUCTION_READINESS_CHECKLIST.md`

Notes:

- `backend/node_modules` exists locally and is large, but this is environment state rather than app architecture.
- Documentation coverage is now strong.
- The app still has a large legacy/general CRUD surface and a very large `backend/routes/crud.js`.

## 2. Frontend Architecture Result

Result: **good operational coverage, high state complexity**

Key files:

- `src/App.jsx`: about 2,220 lines. It owns most top-level app state, backend hydration, persistence, modals, handler composition, route props, finance/calendar/client/package/certificate wiring, and integration hooks.
- `src/components/AppRoutes.jsx`: about 312 lines. Routes are now lazy-loaded with `React.lazy` and `Suspense`.
- Hooks are domain-oriented:
  - `useCalendarActions`
  - `usePaymentJournal`
  - `useDayCloseHandlers`
  - `usePayrollHandlers`
  - `useCertificateHandlers`
  - `useClientHandlers`
  - integration and automation hooks.
- API layer is split by domain:
  - `src/api/visits.js`
  - `src/api/financial.js`
  - `src/api/clients.js`
  - `src/api/functions.js`
  - related entity APIs.

Strengths:

- Financial API helpers now point to backend transaction endpoints for critical flows.
- All top-level pages in `AppRoutes.jsx` are lazy-loaded.
- `xlsx` is loaded dynamically on export.
- UI has explicit notification/error paths for many backend failures.
- `localStorage` is treated as cache for several CRM states; backend remains the durable source for core data after hydration.

Risks:

- `App.jsx` is still the main frontend complexity hotspot.
- State synchronization after backend transaction responses remains fragile because many collections are updated manually in hooks.
- `localStorage`/session cache still contains broad CRM snapshots and auth token/session data.
- Some non-ledger ordinary journal operations still use legacy `createVisit/updateVisit/deleteVisit` helpers.
- Dead-code risk remains in old utility paths, Supabase legacy utilities, and import/backup paths.

## 3. Backend Architecture Result

Result: **functional and hardened around critical flows, but route file is too large**

Key files:

- `backend/server.js`: Express app, CORS, Helmet, auth routes, `/functions` and `/api` protected by JWT.
- `backend/routes/auth.js`: local admin login, JWT issuing, session endpoint.
- `backend/routes/crud.js`: about 4,824 lines. Contains generic CRUD plus new transaction endpoints.
- `backend/routes/functions.js`: integration/function endpoints, owner guarded.
- `backend/middleware/auth.js`: `verifyJwt`, `requireOwner`.
- `backend/utils/httpErrors.js`: generic 500 response hardening.
- `backend/services/loggingService.js`: AuditLog/ErrorEvent write helpers.

Strengths:

- `/api/*` and `/functions/*` are protected by `verifyJwt`.
- Critical destructive/owner routes have `requireOwner`.
- Source-of-truth financial endpoints use Prisma transactions.
- Error mapping avoids raw unexpected 500 leakage.
- AuditLog and ErrorEvent are centralized.

Risks:

- `backend/routes/crud.js` mixes generic CRUD, financial transactions, validation helpers, payroll/day close logic, and destructive routes in one large file.
- `PrismaClient` is created in multiple route/service files rather than a single shared module.
- Some old CRUD routes still accept broad payloads and use `Number(req.params.id)`/legacy date parsing.
- `POST /api/visits/complete`, `POST /api/visits/update-completed`, and journal financial create/update remain authenticated-only by design, not owner-only.

## 4. Database / Prisma Result

Result: **adequate for current transaction flow, with nullable relationship risks**

Schema highlights:

- Core entities: `Client`, `Service`, `Employee`, `Visit`, `CalendarEntry`.
- Financial entities: `Package`, `ClientPackage`, `ClientPackageUsage`, `Certificate`, `CertificateUsage`, `DayCloseRecord`, `PayrollRecord`.
- Logging entities: `AuditLog`, `ErrorEvent`, `NotificationDelivery`, `IntegrationJob`.

Ledger models:

- `ClientPackageUsage`
  - `clientPackageId`
  - nullable `visitId`
  - `sessionsUsed`
  - `revertedAt`
  - `@@unique([clientPackageId, visitId])`
- `CertificateUsage`
  - `certificateId`
  - nullable `visitId`
  - `amount`
  - `revertedAt`
  - `@@unique([certificateId, visitId])`

Strengths:

- Ledger uniqueness protects visit-linked usage against double-spend.
- `revertedAt` supports idempotent restore.
- `DayCloseRecord.date` is unique.
- `PayrollRecord.periodKey` is unique.
- Audit/Error models have useful indexes.

Risks:

- `CalendarEntry.visitId` is a nullable integer without a Prisma relation to `Visit`.
- `Certificate.saleVisitId` exists but is not a relation field.
- `ClientPackage` has no `saleVisitId`, so package sale cannot safely create/link a payment journal entry without schema design.
- Many business-critical fields are nullable and/or mirrored in `payload` JSON.
- `Visit.payload` and `CalendarEntry.payload` remain compatibility-critical and can diverge if old routes are used incorrectly.
- `onDelete: Cascade` on ledger parent relations is useful but dangerous if package/certificate deletion happens with historical ledger that should remain auditable.

## 5. Finance Re-Check Result

Result: **pass for critical migrated flows**

Source-of-truth endpoints checked:

| Endpoint | Result | Notes |
| --- | --- | --- |
| `POST /api/visits/complete` | Pass | Ordinary/package/certificate/mixed complete in transaction. |
| `POST /api/visits/revert-completed` | Pass | Reverts completed visits, restores ledgers, owner guarded. |
| `POST /api/visits/update-completed` | Pass | Updates ordinary/package/certificate/mixed completed visits atomically. |
| `POST /api/calendar-entries/delete-completed` | Pass | Deletes completed entry and visit, restores package/certificate ledger. |
| `POST /api/visits/journal/financial` | Pass | Journal-only package/certificate create with ledger. |
| `PUT /api/visits/journal/:id/financial` | Pass | Journal-only package/certificate update with restore/apply ledger. |
| `POST /api/visits/journal/:id/delete-financial` | Pass | Journal-only package/certificate delete with restore ledger, owner guarded. |
| `POST /api/certificates/sell` | Pass | Certificate sale creates certificate and sale visit in one transaction. |
| `POST /api/day-close-records/close` | Pass | Backend-calculated day close, owner guarded. |
| `GET /api/payroll/summary` | Pass | Backend payroll summary, owner guarded. |
| `POST /api/payroll/mark-paid` | Pass | Payroll record upsert/mark paid, owner guarded. |

Scenario re-check:

| Scenario | Result | Notes |
| --- | --- | --- |
| Ordinary completed visit | Pass | Uses complete/update/revert/delete-completed endpoints. |
| Package completed visit | Pass | Uses `ClientPackageUsage`, guarded decrement/restore. |
| Certificate completed visit | Pass | Uses `CertificateUsage`, guarded decrement/restore. |
| Mixed package+certificate | Pass | Both ledgers handled atomically; partial ledger state rejected. |
| Revert/delete/update | Pass | Completed calendar flows use transaction endpoints. |
| Journal-only package/certificate | Pass | Dedicated create/update/delete financial journal endpoints exist. |
| Certificate sale | Pass | `POST /api/certificates/sell`. |
| Package sale | Medium follow-up | Single request `POST /api/client-packages`; no unsafe multi-request flow, but no sale visit link. |
| Day close | Pass | Backend-calculated endpoint. |
| Payroll | Pass | Backend summary/mark-paid. |
| Legacy financial guards | Pass | Legacy day close/payroll writes require `allowLegacyFinancialWrite: true`. |
| `updatePackageBalance`/`updateCertificateBalance` absence | Pass | No remaining references found in `src`/`backend`. |
| AuditLog coverage | Pass with minor gaps | Critical financial writes log AuditLog; no AuditLog UI. |
| RBAC coverage | Pass for owner-sensitive paths | Operational write routes still authenticated-only by design. |

Finance verdict:

Critical finance source-of-truth is backend transaction based. No direct frontend package/certificate balance update helpers remain. The next finance design item is package sale modeling only if package sales must appear as linked payment journal records.

## 6. Integrations Result

Result: **guarded, partially stubbed**

Checked integrations:

- SMS bulk: `/functions/bulk-sms`, owner guarded, validates action/recipients/test number, writes AuditLog/ErrorEvent.
- Telegram digest: `/functions/telegram-digest`, owner guarded, AuditLog.
- SMS reminders: `/functions/sms-reminders`, owner guarded, AuditLog.
- Owner notifications: `/functions/owner-notify`, owner guarded, AuditLog.
- Review requests: `/functions/review-requests`, owner guarded, AuditLog.
- Booksy sync: `/functions/booksy-sync`, owner guarded, currently stub/TODO.
- Backup script: `backend/scripts/backup-db.js`, safe `pg_dump` helper.
- Excel export: `src/utils/exportExcel.js`, dynamic `xlsx` import.
- Import/Booksy/Gmail utilities exist and have test coverage in parts.

Risks:

- Booksy sync is explicitly a placeholder.
- Integration endpoints other than bulk SMS have less input validation than core finance endpoints.
- Provider failures need production monitoring via `NotificationDelivery`, `IntegrationJob`, logs, and ErrorEvent.

## 7. Security Result

Result: **materially improved, coarse-grained**

Strengths:

- `/api/auth/login` is the only public auth entrypoint.
- `/api/*` is protected by `verifyJwt`.
- `/functions/*` is protected by `verifyJwt`.
- JWT includes `role: "owner"` for admin login.
- `requireOwner` protects payroll, day close close, destructive routes, employees writes, settings/system-state writes, legacy financial writes, and functions routes.
- CORS supports explicit `CORS_ORIGIN`; local/private network origins are allowed only when `NODE_ENV !== 'production'`.
- Helmet is enabled.
- Raw unexpected 500 messages are not sent to frontend.

Risks:

- No granular RBAC yet.
- Auth token/session are stored in `localStorage`.
- Public login has AuditLog but no visible rate limiting.
- Many authenticated-only write routes can mutate operational data if a valid non-owner JWT ever exists.
- No dedicated AuditLog viewer/API for operational review.
- No explicit RLS review documented for Supabase legacy/site paths in this repo.

## 8. Testing Result

Result: **good utility coverage, weak backend transaction integration coverage**

Observed:

- Vitest test suite exists and covers many frontend utilities:
  - finance calculations;
  - day close utilities;
  - payroll utilities;
  - booking/import/sync helpers;
  - backup format;
  - alerts;
  - settings and routing utilities.
- Manual finance checklist exists.
- UI regression checklist exists.
- Production readiness checklist exists.

Missing/high-value tests:

- Backend integration tests for transaction endpoints:
  - complete/revert/update/delete completed visit;
  - package/certificate/mixed ledgers;
  - journal-only package/certificate;
  - day close close;
  - payroll summary/mark-paid;
  - legacy financial guards.
- Auth/RBAC endpoint tests.
- Error handling tests for generic 500 sanitization.
- E2E tests for frontend state sync after backend transaction responses.

## 9. Performance Result

Result: **chunk warning resolved, App shell still large**

Current performance facts from `PERFORMANCE_CHUNK_AUDIT.md`:

- Main `index-*.js` chunk reduced from about `501 kB` to about `398.78 kB`.
- Vite large chunk warning is gone.
- All top-level pages in `AppRoutes.jsx` are lazy-loaded.
- `xlsx` is dynamically imported on export action.

Remaining risks:

- `App.jsx` remains about 2,220 lines.
- CSS remains large.
- Vendor chunks are still significant:
  - `vendor-xlsx`
  - `vendor-Box`
  - `vendor-recharts`
  - `vendor-supabase`
  - `vendor-react-dom`
- Framer Motion/toast/drawer and shared shell imports still contribute to the main entry.

## 10. Documentation Result

Result: **strong**

Existing docs checked:

- `FINAL_NUAR_CRM_AUDIT_REPORT.md`
- `FINANCE_LEGACY_AUDIT.md`
- `AUTH_PERMISSIONS_AUDIT.md`
- `AUDIT_LOG_AUDIT.md`
- `FUNCTIONS_ROUTES_AUDIT.md`
- `VALIDATION_ERROR_HANDLING_AUDIT.md`
- `BACKUP_RESTORE_STRATEGY.md`
- `MANUAL_FINANCE_TEST_CHECKLIST.md`
- `UI_REGRESSION_CHECKLIST.md`
- `PERFORMANCE_CHUNK_AUDIT.md`
- `PRODUCTION_READINESS_CHECKLIST.md`
- `DEPLOY_HETZNER.md`
- `README_DEPLOY_WINDOWS.md`
- `AGENTS.md`

Documentation gaps:

- No backend transaction endpoint contract document with exact request/response examples.
- No role matrix beyond current audit docs.
- No restore drill result log.
- No production monitoring/runbook for ErrorEvent/NotificationDelivery triage.

## Top 20 Risks

| # | Risk | Severity | Area | Recommended next move |
| ---: | --- | --- | --- | --- |
| 1 | Missing backend integration tests for transaction endpoints | High | Testing/finance | Add Prisma test DB integration suite. |
| 2 | Coarse RBAC: no manager/master/readonly roles | High | Security | Design granular role matrix and backend guards. |
| 3 | Large `backend/routes/crud.js` mixes too many concerns | High | Backend | Split route groups only after smoke. |
| 4 | Large `App.jsx` owns too much state | High | Frontend | Extract state domains after production smoke. |
| 5 | Package sale has no sale payment linkage | Medium | Finance/schema | Design `ClientPackage.saleVisitId` or equivalent if journal sale needed. |
| 6 | `CalendarEntry.visitId` is not a Prisma relation | Medium | Database | Consider relation migration after stabilization. |
| 7 | `Certificate.saleVisitId` is not a Prisma relation | Medium | Database | Add relation only with migration plan. |
| 8 | Many business fields are nullable and mirrored in JSON payload | Medium | Database/backend | Add phased normalization/validation. |
| 9 | Legacy CRUD still accepts broad payloads | Medium | Backend/security | Continue route-group hardening. |
| 10 | Auth tokens stored in `localStorage` | Medium | Security | Consider httpOnly cookie/session hardening. |
| 11 | No login rate limiting | Medium | Security | Add minimal rate limit for `/api/auth/login`. |
| 12 | No AuditLog viewer/API | Medium | Operations | Add owner-only audit viewer endpoint/UI. |
| 13 | Booksy sync is stubbed | Medium | Integrations | Keep disabled or implement real provider contract. |
| 14 | Integration endpoints have uneven validation | Medium | Integrations | Add input schemas per function route. |
| 15 | Backend creates multiple `PrismaClient` instances | Low/Medium | Backend | Introduce shared Prisma client module. |
| 16 | Some old routes still use `Number(req.params.id)` | Low/Medium | Validation | Apply route id parser broadly. |
| 17 | Legacy date parsing can accept invalid dates | Low/Medium | Validation | Add date parser helpers per route group. |
| 18 | CSS bundle remains large | Low/Medium | Performance | Audit CSS splitting/removal later. |
| 19 | Restore process is manual and not drill-proven | Medium | Backup/ops | Run staging restore drill. |
| 20 | Frontend state sync after transaction responses is manual | Medium | Frontend/finance | Add E2E smoke tests and response-normalization helpers. |

## Recommended Next 10 Stages

1. **Staged production smoke** using `PRODUCTION_READINESS_CHECKLIST.md`, `MANUAL_FINANCE_TEST_CHECKLIST.md`, and `UI_REGRESSION_CHECKLIST.md`.
2. **Backend transaction integration tests** for complete/revert/update/delete, journal-only, mixed ledger, day close, payroll.
3. **Auth/RBAC test pass** for owner vs authenticated-only routes.
4. **Login hardening**: minimal rate limiting and suspicious login ErrorEvent/AuditLog policy.
5. **AuditLog viewer**: owner-only read endpoint and small UI page or admin panel.
6. **Package sale schema design** if package sales must become linked payment journal records.
7. **Backend route split**: move financial transaction endpoints out of `crud.js` into focused routers.
8. **Frontend state domain split**: reduce `App.jsx` after smoke, starting with finance/calendar domains.
9. **Validation phase 2**: route id/date parser rollout to remaining generic CRUD routes.
10. **Backup restore drill**: run staging restore from backup and document result.

## Pre-Deploy Verification

Before deploy:

- Confirm `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`, and integration env values.
- Run a fresh DB backup with `npm run db:backup`.
- Confirm migrations are committed and `npx prisma validate` passes.
- Run automated checks:
  - `npm test`
  - `npm run build`
  - `cd backend && npx prisma validate`
  - `node --check backend/server.js`
  - `node --check backend/routes/crud.js`
  - `node --check backend/routes/auth.js`
  - `node --check backend/routes/functions.js`
  - `node --check backend/middleware/auth.js`
  - `node --check backend/utils/httpErrors.js`
- Perform staged production smoke for:
  - ordinary/package/certificate/mixed completed visits;
  - revert/delete/update completed visits;
  - journal-only package/certificate;
  - certificate sale;
  - package sale;
  - day close;
  - payroll summary/mark-paid;
  - owner guards;
  - legacy financial guards;
  - backup/restore readiness;
  - UI refresh/state sync.

## Test Results

Automated checks for this stage:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 44 files, 173 tests |
| `npm run build` | Passed: Vite build completed, main `index` chunk `398.78 kB`, no large chunk warning |
| `cd backend && npx prisma validate` | Passed: Prisma schema is valid |
| `node --check backend/server.js` | Passed |
| `node --check backend/routes/crud.js` | Passed |
| `node --check backend/routes/auth.js` | Passed |
| `node --check backend/routes/functions.js` | Passed |
| `node --check backend/middleware/auth.js` | Passed |
| `node --check backend/utils/httpErrors.js` | Passed |

## Final Verdict

NUAR CRM is globally in a **staged-production-smoke-ready** state.

Finance is the strongest hardened area after the recent work. Backend security and validation are materially better, but still intentionally minimal. The safest next action is not another refactor: run staged smoke, capture any production-like issues, then add backend integration tests around the transaction endpoints before further architectural cleanup.
