# NUAR CRM Auth Email Setup

Password reset email is sent by the backend only. Frontend never receives SMTP
credentials.

## Required Env

Set these on the backend host:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=smtp-user
EMAIL_PASS=smtp-password
EMAIL_FROM="NUAR CRM <no-reply@nuarr.pl>"
AUTH_RESET_BASE_URL=https://crm.nuarr.pl/reset-password
```

Optional:

```env
AUTH_EMAIL_FROM="NUAR CRM <security@nuarr.pl>"
AUTH_RESET_TOKEN_TTL_MINUTES=45
```

`AUTH_EMAIL_FROM` overrides `EMAIL_FROM` only for auth emails.
`AUTH_RESET_TOKEN_TTL_MINUTES` is clamped to 30-60 minutes.

## Dev vs Production

Development:

- `POST /api/auth/forgot-password` may include `resetUrl` in the JSON response.
- Raw tokens are still never stored in the database.

Production:

- `POST /api/auth/forgot-password` always returns a generic success response.
- The reset URL is sent only by email.
- If SMTP is missing or delivery fails, the backend writes `AuditLog` and
  `ErrorEvent`; it does not return the token or reset URL.

## How To Test SMTP

1. Configure the env above on the backend.
2. Restart the backend process.
3. Ensure the DB owner exists and is active.
4. Call:

```bash
curl -i -X POST https://api.nuarr.pl/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com"}'
```

5. Confirm the API returns generic success.
6. Check the mailbox for a reset link.
7. Open the link and submit a strong new password.
8. Check logs:

- `AuditLog.action = "password reset requested"`
- `AuditLog.action = "reset email sent"`
- on failure: `AuditLog.action = "reset email failed"` and an `ErrorEvent` with
  `source = "auth.password-reset-email"`

## Safety Notes

- Never put SMTP env into Vite/frontend env.
- Never log raw reset tokens.
- Do not disable `ADMIN_EMAIL` fallback until DB auth is fully verified on prod.
