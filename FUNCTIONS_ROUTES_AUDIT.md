# Functions Routes Audit

Date: 2026-07-06

## Scope

Audited `backend/routes/functions.js`, mounted in `backend/server.js` as:

- `/functions/*`
- protected globally by `verifyJwt`

This stage does not change financial transaction logic and does not change Prisma schema.

## Endpoint Map

| Endpoint | Type | Side effects | Previous guard | Current guard | AuditLog |
| --- | --- | --- | --- | --- | --- |
| `POST /functions/bulk-sms` with `action: "status"` | Operational read/status | None | `verifyJwt` | `verifyJwt` + `requireOwner` | No AuditLog for status |
| `POST /functions/bulk-sms` with `action: "test"` | Write/external send | Sends SMS and writes `NotificationDelivery` | `verifyJwt` | `verifyJwt` + `requireOwner` | `send bulk sms test` |
| `POST /functions/bulk-sms` with `action: "send"` | Bulk write/external send | Sends SMS to many recipients and writes `NotificationDelivery` | `verifyJwt` | `verifyJwt` + `requireOwner` | `send bulk sms` |
| `POST /functions/telegram-digest` | External send/write | Sends Telegram message and writes `NotificationDelivery` | `verifyJwt` | `verifyJwt` + `requireOwner` | `send telegram digest` |
| `POST /functions/sms-reminders` | Bulk write/external send/schedule | Sends or schedules SMS, writes `NotificationDelivery` | `verifyJwt` | `verifyJwt` + `requireOwner` | `send sms reminders` |
| `POST /functions/owner-notify` | External send | Sends owner email | `verifyJwt` | `verifyJwt` + `requireOwner` | `send owner notification` |
| `POST /functions/review-requests` | External send | Sends review request email | `verifyJwt` | `verifyJwt` + `requireOwner` | `send review request` |
| `POST /functions/booksy-sync` | Stub / future integration | Currently logs payload and returns placeholder; may mutate visits/settings later | `verifyJwt` | `verifyJwt` + `requireOwner` | `run booksy sync` |

## Read-Only Endpoints

There are no true GET read-only endpoints in `backend/routes/functions.js`.

`POST /functions/bulk-sms` with `action: "status"` behaves like a read/status operation, but it shares the same route as SMS send/test. It is now owner-guarded with the route.

## Write, Bulk, Or Destructive Endpoints

| Endpoint | Risk | Reason |
| --- | --- | --- |
| `POST /functions/bulk-sms` | High | Can send up to `MAX_RECIPIENTS` SMS messages and creates delivery records |
| `POST /functions/sms-reminders` | High | Can send immediate SMS or schedule future SMS |
| `POST /functions/telegram-digest` | Medium | Sends external Telegram message and writes delivery record |
| `POST /functions/owner-notify` | Medium | Sends email to owner |
| `POST /functions/review-requests` | Medium | Sends external email to reviewer |
| `POST /functions/booksy-sync` | Medium future risk | Currently a stub, but semantically a sync endpoint that may later mutate CRM data |

No endpoint in this file directly mutates visits, clients, settings, payroll, day close, packages, certificates, or Prisma financial ledgers.

## Changes Made

1. Added `requireOwner` to all routes in `backend/routes/functions.js`.
2. Added AuditLog writes for external-send and sync operations.
3. Added ErrorEvent logging for failed bulk SMS execution.
4. Audit metadata intentionally avoids storing full message bodies, email contents, or phone numbers.

## AuditLog Format Used

All function route audit entries use:

- `entity: "Function"`
- `entityId: req.path`
- `action`: human-readable operation name
- `after`: compact metadata, for example recipient counts, booleans like `hasMessage`, and result counts
- `before: null`

## Remaining Work

1. Consider splitting `POST /functions/bulk-sms` status into a true `GET` endpoint if status becomes real state.
2. If Booksy sync becomes active and mutates CalendarEntry/Visit/Client data, it should get dedicated transaction logic and domain-specific AuditLog entries.
3. If notification content must be auditable for compliance, add a deliberate redaction policy before storing message text in AuditLog.
4. The older frontend utilities that call Supabase Edge Functions directly remain outside this backend route audit.

