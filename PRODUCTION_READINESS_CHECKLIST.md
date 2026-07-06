# Production Readiness Checklist

Date: 2026-07-06

Purpose: final deployment checklist for NUAR CRM after finance, RBAC, AuditLog, validation/error handling, backup/restore, UI regression, and performance cleanup stages.

Use this as the go/no-go runbook before deploying backend or frontend changes to production.

## 1. Pre-Deploy Environment Check

Backend env:

- `DATABASE_URL` points to the intended production PostgreSQL database.
- `ADMIN_EMAIL` is set.
- `ADMIN_PASSWORD` is set and strong.
- `JWT_SECRET` is set and at least 32 random characters.
- `PORT` is set or defaults intentionally.
- `CORS_ORIGIN` contains only approved production/staging frontend origins.
- Optional integrations are either configured or intentionally empty:
  - `SMSAPI_TOKEN`
  - `SMSAPI_FROM` / sender value used by current service config
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_OWNER_CHAT_ID`
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
- Backup helper values are safe:
  - `BACKUP_DIR`
  - optional `PGDUMP_PATH`

Frontend env:

- `VITE_BACKEND_URL` points to the production backend.
- `VITE_ENABLE_AUTOMATION_STATUS` is set intentionally.
- Legacy Supabase envs are either configured for active flows or intentionally empty:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SITE_URL`

Security:

- No real secrets are committed.
- `.env`, `.env.*`, dump files, and backup folders are ignored by git.
- Production frontend origin is the only public UI origin allowed by backend CORS.

## 2. Database Migration Check

Before deploy:

```bash
cd backend
npx prisma validate
npm run prisma:generate
```

Confirm:

- All expected migration folders exist in `backend/prisma/migrations`.
- No unfinished local migration folder is missing from git.
- No Prisma schema drift is expected.
- Migration has been tested against staging or a restored production-like backup.

Production migration command:

```bash
cd backend
npm run prisma:deploy
```

Do not run `prisma migrate dev` against production.

## 3. Backup Before Deploy

Create a fresh backup before applying production migrations or restarting services:

```bash
npm run db:backup
```

Verify:

- Dump file exists.
- Dump file size is non-zero.
- Dump is copied to restricted storage outside the repo/server if this is a real production deploy.
- Filename/time is recorded in the deploy notes.

Reference:

- `BACKUP_RESTORE_STRATEGY.md`

## 4. Required Automated Checks

Run from repo root:

```bash
npm test
npm run build
```

Run backend checks:

```bash
cd backend
npx prisma validate
```

Run syntax checks from repo root:

```bash
node --check backend/server.js
node --check backend/routes/crud.js
node --check backend/routes/auth.js
node --check backend/routes/functions.js
```

Expected:

- Tests pass.
- Build passes.
- No Vite chunk warning over 500 kB.
- Prisma schema is valid.
- Node syntax checks pass.

## 5. Deploy Steps

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy
pm2 restart nuar-backend --update-env
```

Frontend:

- Deploy the Vite app through the normal hosting provider flow.
- Confirm frontend build uses production `VITE_BACKEND_URL`.

After backend restart:

```bash
curl https://<backend-host>/health
```

Expected:

```json
{"status":"ok"}
```

## 6. Post-Deploy Smoke Tests

Run immediately after deploy.

Login/RBAC:

- Login with owner credentials.
- Refresh page and confirm session remains.
- Call or trigger one owner-protected action with owner token and confirm success.
- If a non-owner token is available, confirm owner endpoint returns 403.

Core read smoke:

- Open Today.
- Open Calendar.
- Open Clients.
- Open Payments.
- Open Packages.
- Open Masters/Employees.
- Open Settings.

Finance smoke:

- Complete one ordinary staging-safe visit or use a controlled test record.
- Complete/revert one package or certificate visit in staging if possible.
- Confirm payment journal row appears.
- Refresh and confirm state matches.

Day close / payroll smoke:

- Open day close panel and verify backend totals load.
- Open payroll summary for a safe period.
- Mark payroll paid only in staging or approved test period.

AuditLog:

- Confirm recent critical write created AuditLog row:
  - login success
  - complete/revert/update/delete finance action
  - day close or payroll mark-paid if tested

ErrorEvent:

- Check no unexpected new `ErrorEvent` rows after smoke.

## 7. Manual Regression References

Use these when the deploy includes finance/UI/security changes:

- `MANUAL_FINANCE_TEST_CHECKLIST.md`
- `UI_REGRESSION_CHECKLIST.md`
- `AUTH_PERMISSIONS_AUDIT.md`
- `AUDIT_LOG_AUDIT.md`
- `VALIDATION_ERROR_HANDLING_AUDIT.md`

Minimum production-like finance regression:

- ordinary completed visit
- package completed visit
- certificate completed visit
- mixed package + certificate completed visit
- revert completed visit
- update completed visit
- delete completed calendar entry
- journal-only package/certificate edit/delete
- certificate sale
- package sale
- day close
- payroll summary
- payroll mark-paid

## 8. Backup Restore Drill

Do not perform production restore as part of normal deploy.

Before go-live or after major schema changes:

1. Take production backup.
2. Restore it into local/staging database.
3. Run:

```bash
cd backend
npx prisma validate
npm run prisma:deploy
```

4. Start backend against restored database.
5. Smoke test:
   - login;
   - clients;
   - calendar;
   - payment journal;
   - package/certificate balances;
   - day close;
   - payroll summary.

Pass condition:

- Latest backup can be restored into a clean database and CRM can read critical screens.

## 9. Monitoring / Logs

During and after deploy monitor:

- backend process logs;
- reverse proxy logs if applicable;
- frontend hosting deploy logs;
- browser console on first load;
- `ErrorEvent` table;
- `AuditLog` table;
- database connection errors;
- Prisma errors;
- SMS/Telegram/email integration errors if actions are used.

First 30 minutes after deploy:

- Watch for 401/403 spikes.
- Watch for 500 responses.
- Watch for duplicate financial write symptoms.
- Watch for slow initial frontend load.

First business day after deploy:

- Verify day close.
- Verify payroll summary.
- Verify one completed visit flow end-to-end.

## 10. Rollback Plan

Frontend rollback:

- Revert to previous hosting deployment.
- Confirm `VITE_BACKEND_URL` still points to compatible backend.

Backend code rollback:

- Keep previous git commit/build available.
- Re-deploy previous backend code.
- Restart process with previous env.

Database rollback:

- Prefer forward fix if data is intact.
- Use restore only if data is corrupted and there is an approved maintenance window.
- Restore from pre-deploy backup using `BACKUP_RESTORE_STRATEGY.md`.
- After restore, run smoke tests before reopening CRM.

Critical rule:

- Do not restore production database without stopping writes and confirming the backup file.

## 11. Go / No-Go Criteria

### Go

Deploy is allowed when all are true:

- Fresh backup exists and is verified non-empty.
- `npm test` passes.
- `npm run build` passes without chunk warning over 500 kB.
- `npx prisma validate` passes.
- Node syntax checks pass for backend entry/routes.
- Production env variables are reviewed.
- Migrations were tested on staging/restored DB.
- Owner login works in staging.
- Finance smoke passes in staging or controlled production-like environment.
- Rollback owner and backup location are known.

### No-Go

Do not deploy when any are true:

- No fresh backup.
- Prisma validation fails.
- Tests fail.
- Build fails.
- Backend syntax check fails.
- Unknown migration impact on production data.
- Finance smoke fails.
- Owner login/RBAC is broken.
- ErrorEvent shows unexplained backend failures during staging smoke.
- Rollback path is unclear.

### Conditional Go

Allowed only with explicit owner approval:

- Build passes but has non-critical warnings.
- A known non-critical UI issue exists and has a documented workaround.
- A third-party integration is disabled/misconfigured but not needed for current operations.

## 12. Known Remaining Risks

RBAC:

- Only minimal owner role exists.
- No granular roles such as manager/master/readonly.
- Some operational create/update finance endpoints remain authenticated-only by design.

AuditLog:

- No owner UI/API for reading AuditLog yet.
- Auth session refresh/read actions are not audited to avoid noise.

Backup/restore:

- Backup is manual.
- Restore drill is documented but not automated.
- No scheduled encrypted offsite backup rotation yet.

Frontend architecture:

- `src/App.jsx` remains large and owns many state domains.
- Transaction endpoint responses require careful frontend state replacement to avoid stale balances.

Performance:

- Main chunk is now below warning threshold, but CSS and vendor chunks remain large.
- Further work should target modal lazy loading and gradual `App.jsx` state extraction.

Validation:

- Critical finance validation is hardened.
- Some legacy/general CRUD routes still have older date/id/numeric parsing patterns.

Operational:

- Package sale still has no dedicated schema-linked sale payment record by design.
- Supabase legacy utilities remain for site/admin/older flows and should be reviewed before removing.

