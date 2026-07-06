# Auth / Permissions Audit

Date: 2026-07-06

## Current Auth Mechanisms

### Backend

- `backend/server.js`
  - Public:
    - `GET /health`
    - `POST /api/auth/login`
  - Protected by `verifyJwt`:
    - `/api/*`
    - `/functions/*`
- `backend/middleware/auth.js`
  - Requires `Authorization: Bearer <token>`.
  - Verifies token with `JWT_SECRET`.
  - Stores decoded payload in `req.auth`.
  - Does not enforce roles or permissions.
- `backend/routes/auth.js`
  - `POST /api/auth/login` accepts only `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
  - Issues a local JWT for user `{ id: "local-admin", email: ADMIN_EMAIL }`.
  - `GET /api/auth/session` verifies JWT and returns current user.

### Frontend

- `src/hooks/useAuth.js`
  - Stores local JWT in `localStorage`.
  - Sends it through API helpers as `Authorization: Bearer ...`.
  - Google/Supabase login and password reset are currently disabled in the CRM UI.
- `src/components/AppGate.jsx`
  - Hides the CRM UI until a valid session is restored.
- API helpers in `src/api/*`
  - Attach the auth token and clear the session on `401`.

### Supabase

- Supabase client still exists for site/admin utilities and older cloud sync paths.
- Current local auth path sets `authSession.provider = "local"`, so CRM cloud sync with Supabase is disabled for local sessions.
- The main backend CRUD data path is Express + Prisma, not direct Supabase table access.

## Real Roles

Minimal backend RBAC now exists.

- `Employee.role` is a staff/job label such as massage role, not an access-control role.
- `POST /api/auth/login` issues a JWT with `role: "owner"` for the current `ADMIN_EMAIL` / `ADMIN_PASSWORD` login.
- `backend/middleware/auth.js` exports `requireOwner`.
- `requireOwner` accepts:
  - `req.auth.role === "owner"`;
  - legacy `local-admin` tokens;
  - tokens whose email matches `ADMIN_EMAIL`.
- There are no granular roles yet: no `manager`, `master`, or `readonly` role is active.

## Access Map

Given the current implementation, any authenticated JWT can:

- Read clients:
  - `GET /api/clients`
  - `GET /api/clients/:id`
  - `GET /api/visit-state`
- Create/edit/delete visits and calendar entries:
  - `/api/visits*`
  - `/api/calendar-entries*`
- See finance:
  - `GET /api/financial-state`
  - `GET /api/day-close-records`
  - `GET /api/payroll-records`
- Read employees:
  - `GET /api/employees`
  - `GET /api/employees/:id`
- Delete data:
  - All `DELETE /api/*` routes exposed by `backend/routes/crud.js`.
- Trigger operational functions:
  - `/functions/bulk-sms`
  - `/functions/telegram-digest`
  - `/functions/sms-reminders`
  - `/functions/owner-notify`
  - `/functions/review-requests`
  - `/functions/booksy-sync`
- Change system state/settings:
  - `GET /api/system-state*`

Only owner can:

- Close day:
  - `POST /api/day-close-records/close`
- Use legacy financial writes:
  - `POST /api/day-close-records`
  - `PUT /api/day-close-records/:id`
  - `POST /api/payroll-records`
  - `PUT /api/payroll-records/:id`
- See payroll summary and mark payroll paid:
  - `GET /api/payroll/summary`
  - `POST /api/payroll/mark-paid`
- Create/edit/delete employees:
  - `POST /api/employees`
  - `PUT /api/employees/:id`
  - `DELETE /api/employees/:id`
- Write settings/system state:
  - `PUT /api/system-state/:key`
  - `PUT /api/system-state`
- Delete records through destructive backend endpoints listed below.

## Audit Log Visibility

- AuditLog is written by backend helpers in `backend/routes/crud.js` and `backend/services/loggingService.js`.
- There is no public or frontend API endpoint to read `AuditLog`.
- Backend operators with database access can inspect it directly.

## Protected Endpoints

Protected by `verifyJwt`:

- All `/api/*` routes except `/api/auth/*`.
- All `/functions/*` routes.

Partially protected:

- `GET /api/auth/session` uses JWT verification.

Public:

- `GET /health`
- `POST /api/auth/login`

## Risk Findings

### Improved: minimal owner guard exists

Owner guard now protects the highest-risk route groups.

Protected owner endpoints:

- Payroll:
  - `GET /api/payroll/summary`
  - `POST /api/payroll/mark-paid`
- Day close:
  - `POST /api/day-close-records/close`
- Legacy financial writes:
  - `POST /api/day-close-records`
  - `PUT /api/day-close-records/:id`
  - `POST /api/payroll-records`
  - `PUT /api/payroll-records/:id`
- Employees:
  - `POST /api/employees`
  - `PUT /api/employees/:id`
  - `DELETE /api/employees/:id`
- Settings/system state:
  - `PUT /api/system-state/:key`
  - `PUT /api/system-state`
- Destructive deletes:
  - `DELETE /api/calendar-entries/:id`
  - `POST /api/calendar-entries/delete-completed`
  - `POST /api/visits/revert-completed`
  - `POST /api/visits/journal/:id/delete-financial`
  - `DELETE /api/visits/journal/:id`
  - `DELETE /api/clients/:id`
  - `DELETE /api/services/:id`
  - `DELETE /api/visits/:id`
  - `DELETE /api/tasks/:id`
  - `DELETE /api/waitlist/:id`
  - `DELETE /api/supplies/:id`
  - `DELETE /api/message-templates/:id`
  - `DELETE /api/communication-log/:id`
  - `DELETE /api/packages/:id`
  - `DELETE /api/client-packages/:id`
  - `DELETE /api/certificates/:id`
  - `DELETE /api/day-close-records/:id`
  - `DELETE /api/payroll-records/:id`

Remaining limitation:

- There are still no granular non-owner roles.
- Most non-delete create/update routes remain authenticated-only to avoid breaking normal CRM work.

### High: frontend-only access separation does not exist

The UI has pages and modals, but no permission model. If roles are added later only in frontend, backend endpoints would still allow direct calls unless backend guards are added.

### Improved: destructive endpoints require owner

Covered examples:

- `DELETE /api/clients/:id`
- `DELETE /api/visits/:id`
- `POST /api/visits/revert-completed`
- `POST /api/visits/journal/:id/delete-financial`
- `DELETE /api/calendar-entries/:id`
- `DELETE /api/employees/:id`
- `DELETE /api/services/:id`
- `DELETE /api/packages/:id`
- `DELETE /api/client-packages/:id`
- `DELETE /api/certificates/:id`

### Medium: financial transaction endpoints are still authenticated-only

Examples:

- `POST /api/certificates/sell`
- completed visit transaction endpoints
- journal financial endpoints

Reason:

- These are normal operational CRM flows and were intentionally not locked to owner in this minimal stage.

### Medium: legacy financial CRUD is guarded, but still callable with explicit flag

Legacy routes are intentionally retained for compatibility:

- `POST /api/day-close-records`
- `PUT /api/day-close-records/:id`
- `POST /api/payroll-records`
- `PUT /api/payroll-records/:id`

They now log warnings/AuditLog and require `allowLegacyFinancialWrite: true`.

### Medium: functions endpoints are auth-only

Operational endpoints can send SMS/Telegram/review request style actions. They are protected by JWT but have no role/scoped permission guard.

## Minimal Next Steps

1. Define real non-owner roles:
   - `owner`
   - `admin`
   - `manager`
   - `master`
   - `readonly`
2. Add a backend permission middleware, for example:
   - `requirePermission("finance:read")`
   - `requirePermission("finance:write")`
   - `requirePermission("payroll:read")`
   - `requirePermission("payroll:write")`
   - `requirePermission("employees:write")`
   - `requirePermission("delete:any")`
   - `requirePermission("audit:read")`
3. Keep `local-admin` as full owner for backward compatibility.
4. Add backend guards before changing frontend UI.
5. Add optional read-only `GET /api/audit-log` only after `audit:read` exists.

## Current Recommendation

Do not add frontend-only permissions. The next safe implementation stage should be backend-first:

- introduce granular permissions;
- decide which future roles may complete visits, sell certificates/packages, and edit journal payments;
- then guard:
  - certificate/package sale;
  - completed visit transaction endpoints;
  - journal financial endpoints;
  - functions endpoints.
