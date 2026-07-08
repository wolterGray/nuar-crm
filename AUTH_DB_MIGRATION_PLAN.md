# AUTH DB Migration Plan

Stage 77: DB Auth design audit. This document is a plan only. Do not change runtime auth, Prisma schema, migrations, or frontend behavior in this stage.

## Current State Audit

### `backend/routes/auth.js`

- `POST /api/auth/login` reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` from environment variables.
- Login compares plaintext request password directly to `ADMIN_PASSWORD`.
- On success it signs a JWT with:
  - `id: "local-admin"`
  - `email: ADMIN_EMAIL`
  - `role: "owner"`
  - `sub: "local-admin"`
  - `expiresIn: "7d"`
- On failure it writes an `AuditLog` entry with `action: "login failed"`.
- `GET /api/auth/session` verifies JWT and returns a normalized user object.
- `getSessionRole()` treats `role === "owner"`, `sub/id === "local-admin"`, or email equal to `ADMIN_EMAIL` as owner.

### `backend/middleware/auth.js`

- `verifyJwt()` only checks `Authorization: Bearer <token>` and validates it with `JWT_SECRET`.
- `requireOwner()` trusts JWT claims and the env `ADMIN_EMAIL` match.
- `verifySupabaseJwt` is currently only an alias to `verifyJwt`; this is not Supabase JWT verification.
- There is no DB lookup during request auth, so deactivated users cannot be cut off until token expiration unless `JWT_SECRET` rotates.

### Prisma Schema

- No auth user table exists.
- No password hash field exists.
- No session table exists.
- No password reset token table exists.
- Existing `AuditLog` can be reused for login/reset/security events.
- Existing email fields on `Client` and `Employee` are business data and should not be reused as auth identities.

## Target Models

### `User`

Recommended Prisma shape:

```prisma
model User {
  id                 Int       @id @default(autoincrement())
  email              String    @unique
  passwordHash       String
  role               UserRole  @default(staff)
  isActive           Boolean   @default(true)
  lastLoginAt        DateTime?
  passwordChangedAt  DateTime?
  failedLoginCount   Int       @default(0)
  lockedUntil        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  passwordResetTokens PasswordResetToken[]

  @@index([role])
  @@index([isActive])
}

enum UserRole {
  owner
  admin
  manager
  staff
  readonly
}
```

Notes:
- Use normalized lowercase email for lookup.
- `passwordHash` must never store plaintext. Prefer `argon2id`; `bcrypt` is acceptable if deployment simplicity matters.
- `isActive=false` must block login and can also invalidate active sessions after middleware starts checking DB.
- `lockedUntil` and `failedLoginCount` support brute-force protection without a separate dependency.

### `PasswordResetToken`

Recommended Prisma shape:

```prisma
model PasswordResetToken {
  id         Int       @id @default(autoincrement())
  userId     Int
  tokenHash  String    @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())
  ip         String?
  userAgent  String?

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

Notes:
- Store only a hash of the reset token, never the raw token.
- Token TTL: 15-30 minutes.
- One successful reset should mark the token used and preferably invalidate all existing sessions for that user.

## Roles

Minimum roles for NUAR CRM:

- `owner`: full access, user management, site CMS, integrations, billing/finance, destructive actions.
- `admin`: most CRM access, can manage operations/catalog/clients, cannot change owner or critical auth settings.
- `manager`: day-to-day operations, visits, clients, payments, tasks.
- `staff`: limited own-workflow access if employee accounts are introduced later.
- `readonly`: audit/reporting view only.

Initial migration can implement only `owner` behavior in middleware and reserve other roles for the next permissions stage.

## Endpoints To Add

### Public auth endpoints

- `POST /api/auth/login`
  - Existing endpoint path can remain.
  - Input: `{ email, password }`
  - Output: `{ success, token, user }` for current frontend compatibility.
  - Future output can include refresh/session metadata if using cookies.

- `GET /api/auth/session`
  - Keep existing path.
  - Middleware verifies JWT, then loads DB user by token `sub`.
  - Returns current user only if `isActive=true`.

- `POST /api/auth/forgot-password`
  - Input: `{ email }`
  - Always returns generic success: "If the account exists, reset instructions were sent."
  - Creates `PasswordResetToken` only for active users.
  - Sends email reset link.

- `POST /api/auth/reset-password`
  - Input: `{ token, password }`
  - Hash token, find unused non-expired record.
  - Validate password strength.
  - Update `User.passwordHash`, set `passwordChangedAt`, mark token `usedAt`.

### Owner/admin-only endpoints

- `GET /api/auth/users`
  - Owner/admin list users.

- `POST /api/auth/users`
  - Owner creates user with role and temporary password or email invite.

- `PATCH /api/auth/users/:id`
  - Update role/isActive/email.

- `POST /api/auth/users/:id/reset-password`
  - Owner/admin initiated password reset email or temporary reset token.

- `POST /api/auth/logout`
  - Optional with current stateless JWT.
  - Required if refresh/session storage is added.

## Email Reset Env

Existing services already use `nodemailer` with these env names:

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_SECURE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`

Add:

- `AUTH_RESET_BASE_URL=https://crm.nuarr.pl/reset-password`
- `AUTH_RESET_TOKEN_TTL_MINUTES=30`
- `AUTH_EMAIL_FROM` optional override; fallback to `EMAIL_FROM`
- `AUTH_SUPPORT_EMAIL` optional visible contact for failed reset/support copy

Keep reset email sending server-side only. Never expose SMTP env to frontend.

Operational SMTP setup lives in `AUTH_EMAIL_SETUP.md`.

## Password Strength Validation

Server-side validation is mandatory:

- Minimum 12 characters for owner/admin, 10 for lower roles only if needed.
- Must include at least 3 of: lowercase, uppercase, number, symbol.
- Reject passwords containing the normalized email local part, `nuar`, `admin`, `password`, salon name, or obvious sequences.
- Reject the same password as current password on reset/change.
- Optional later: check breached-password API, but not required for first safe rollout.

Frontend should mirror rules for UX, but backend must be authoritative.

## Login Flow

1. Normalize email to lowercase and trim.
2. Validate basic input shape.
3. Find `User` by email.
4. Always perform similar-time response path for missing user vs wrong password.
5. Reject if `isActive=false`.
6. Reject if `lockedUntil > now`.
7. Verify password hash.
8. On failure:
   - increment `failedLoginCount`;
   - set `lockedUntil` after threshold, e.g. 5 failures for 10 minutes;
   - write `AuditLog`;
   - return generic `Invalid credentials`.
9. On success:
   - reset failed counters;
   - set `lastLoginAt`;
   - sign JWT with `sub=String(user.id)`, `email`, `role`, and a `tokenVersion` or `passwordChangedAt` timestamp if implementing forced invalidation;
   - write `AuditLog`;
   - return current frontend-compatible `{ token, user }`.

## Session Flow

Initial compatible implementation:

- Continue `Authorization: Bearer <JWT>` from frontend.
- JWT `sub` must be DB `User.id`, not `local-admin`.
- `verifyJwt()` verifies signature and exp.
- After verification, middleware loads `User` by `sub`.
- Reject if user not found or inactive.
- Attach:
  - `req.auth.id`
  - `req.auth.email`
  - `req.auth.role`
  - `req.auth.isActive`
- `requireOwner()` should rely on DB role, not env email, once DB auth is primary.

Recommended later hardening:

- Use short-lived access JWT, e.g. 15 minutes.
- Add refresh token/session table with httpOnly, Secure, SameSite cookie.
- Store refresh token hash in DB.
- Rotate refresh tokens on use.
- Keep current localStorage bearer token only as transition mode.

## Migration Path From `ADMIN_EMAIL` To DB Owner

Phase 0: current production safety

- Do not remove `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Confirm DB backup exists.
- Confirm SSH/PM2 access to Hetzner before deploy.

Phase 1: schema-only migration

- Add `User`, `UserRole`, and `PasswordResetToken`.
- Add seed script or migration helper that creates one `owner` user from `ADMIN_EMAIL`.
- Password source options:
  - Preferred: one-time generated temporary password logged only to deploy operator/secure channel.
  - Acceptable transition: hash current `ADMIN_PASSWORD` into DB owner, then rotate it immediately after login.

Phase 2: dual login

- `POST /api/auth/login` tries DB user first.
- If no DB owner exists or DB login fails due to missing auth tables, fallback to current env admin login.
- If DB auth succeeds, issue JWT with DB user id.
- Keep `GET /api/auth/session` accepting both:
  - DB user JWTs;
  - legacy `local-admin` JWTs while fallback is enabled.

Phase 3: owner verification

- Login with DB owner on production.
- Confirm:
  - `/api/auth/session`;
  - CRUD routes;
  - site CMS routes;
  - functions routes;
  - audit logging actor id.
- Change DB owner password through reset/change flow.

Phase 4: make DB primary

- Set `AUTH_DB_ENABLED=true`.
- Set `AUTH_ENV_FALLBACK_ENABLED=true` for one release window.
- Monitor failed login and auth errors.

Phase 5: disable env password fallback

- Set `AUTH_ENV_FALLBACK_ENABLED=false`.
- Keep `ADMIN_EMAIL` only as emergency bootstrap identity if desired.
- Remove `ADMIN_PASSWORD` requirement from `server.js` only in a later cleanup stage.

## Fallback Strategy

Add env flags:

- `AUTH_DB_ENABLED=true|false`
- `AUTH_ENV_FALLBACK_ENABLED=true|false`
- `AUTH_BOOTSTRAP_OWNER_EMAIL`
- `AUTH_BOOTSTRAP_OWNER_PASSWORD` only for one-time bootstrap if not reusing `ADMIN_*`

Behavior:

- If `AUTH_DB_ENABLED=false`, keep current env auth behavior.
- If DB tables are missing or DB query errors during login and fallback is enabled, allow env admin login.
- If DB auth is enabled but no active owner exists, allow env admin login and expose a warning in logs.
- Fallback must be owner-only and audited with `action: "login fallback env owner"`.
- Fallback should never create staff/admin sessions silently.

## Rollback Strategy

Rollback should not require DB deletion.

1. Set `AUTH_DB_ENABLED=false`.
2. Set `AUTH_ENV_FALLBACK_ENABLED=true`.
3. Restart backend.
4. Login using existing `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
5. Existing `User` and `PasswordResetToken` tables remain unused.
6. If a migration must be reverted, do it only after DB backup and after confirming no auth-critical code depends on the tables.

Do not rotate `JWT_SECRET` during rollback unless tokens are compromised. Rotating it logs out all users.

## Security Risks

- Plaintext env password currently exists; moving to DB hash reduces exposure but deployment env remains sensitive.
- Current JWT is stateless and valid for 7 days; inactive users cannot be revoked without DB lookup or secret rotation.
- Current frontend stores token in `localStorage`, which is vulnerable to XSS token theft.
- No rate limiting exists on login/reset endpoints.
- No CSRF protection is needed for Authorization header flow, but it becomes required if cookie refresh sessions are added.
- Reset token leakage via logs, referrers, analytics, or screenshots must be prevented.
- User enumeration risk in forgot-password must be avoided with generic responses.
- Email account compromise becomes account compromise path.
- `verifySupabaseJwt` name is misleading and can cause false assumptions; rename later or document clearly.
- Audit logs should never store raw passwords, reset tokens, or password hashes.

## Deployment Safety: Do Not Lock Yourself Out

Before production deploy:

- Take DB backup.
- Keep current `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` working.
- Deploy schema first, code second.
- Seed or bootstrap DB owner before disabling env fallback.
- Test DB owner login in an incognito browser before logging out existing session.
- Keep SSH/PM2 access open during deploy.
- Keep `AUTH_ENV_FALLBACK_ENABLED=true` until reset flow and DB login are verified.
- Add a health/diagnostic log line at startup:
  - DB auth enabled/disabled;
  - env fallback enabled/disabled;
  - count of active owners, without printing emails/passwords.
- Only disable fallback after at least one active owner can log in and `/api/auth/session` confirms `role: "owner"`.

## Implementation Order For Future Stages

1. Add hashing dependency (`argon2` preferred, `bcryptjs` acceptable if native build risk matters).
2. Add Prisma models and migration.
3. Add bootstrap/seed script for first owner.
4. Add password validation utility and tests.
5. Add reset-token utility that stores token hashes.
6. Add email reset service using existing nodemailer env.
7. Update `routes/auth.js` to dual-auth DB first, env fallback second.
8. Update `middleware/auth.js` to DB-check active users.
9. Add rate limiting for login/reset.
10. Add owner-only user management endpoints.
11. After successful production verification, disable env fallback.
