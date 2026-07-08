# NUAR CRM Notifications Audit

## Current Architecture

Notifications now run through the NUAR backend on Hetzner.

- UI bell: `src/hooks/useClientAlerts.js`
- Frontend API: `src/api/notificationEvents.js`
- Backend API: `backend/routes/notificationEvents.js`
- Smart generator: `backend/services/notificationEventsService.js`
- Delivery planner: `backend/services/notificationDeliveryPlanner.js`
- Outbound queue: `NotificationDelivery`
- Smart inbox table: `NotificationEvent`

No Supabase Edge Functions are required for SMS, Telegram digest, review requests, inactive follow-up, or smart notification events.

## Connected Channels

| Channel | Backend endpoint/service | Required env |
| --- | --- | --- |
| SMS reminders | `/functions/sms-reminders`, `remindersService`, `smsService` | `SMSAPI_TOKEN`, `SMSAPI_SENDER` |
| Bulk SMS | `/functions/bulk-sms`, `smsService` | `SMSAPI_TOKEN`, `SMSAPI_SENDER` |
| Telegram digest | `/functions/telegram-digest`, `telegramService` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Site booking owner alert | `/api/site-booking/*`, `siteBooking` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Review requests | `/functions/review-requests`, local CRM scheduler | `SMSAPI_TOKEN`, review URLs in CRM settings |
| Inactive follow-up | `/functions/bulk-sms`, local CRM scheduler | `SMSAPI_TOKEN` |
| Owner email | `ownerNotifyService` | `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `OWNER_EMAIL` |

## Smart Events Generated

The server generator creates actionable events for:

- overdue and upcoming tasks;
- low or empty supply stock;
- visits today and tomorrow;
- client packages with 0-2 visits left;
- certificates expiring soon or almost spent;
- active waitlist entries.

Events are deduplicated by `fingerprint`, scored from 0-100, and sorted by score. Dismissed and snoozed events are preserved instead of being recreated on every generation.

## Runtime Jobs

Recommended Hetzner cron:

```cron
*/2 * * * * cd /var/www/nuar-crm/backend && npm run notifications:process-due >> /var/log/nuar-crm-notifications.log 2>&1
*/5 * * * * cd /var/www/nuar-crm/backend && npm run notifications:generate >> /var/log/nuar-crm-notification-events.log 2>&1
```

The UI also calls generation before fetching active bell events, so the bell stays useful even if cron is temporarily delayed.

## Delivery Planning

`POST /api/notification-events/plan-delivery` previews delivery candidates for active smart events.

- `commit: false` returns a safe preview.
- `commit: true` queues eligible SMS deliveries, but only when `appSettings.smartNotificationAutoSmsEnabled === true`.
- SMS planning respects quiet hours by moving delivery to the next quiet-hours end.
- SMS planning blocks duplicate delivery per event and recent SMS to the same phone for `notificationSmsCooldownDays` days, default `7`.

## Next Smart Upgrades

- Add visible delivery planner controls to Settings -> Integrations.
- Add more event-to-message templates per channel: Telegram owner summaries and staff-only alerts.
- Add conversion tracking: event created -> action clicked -> booking/payment completed.
- Add AI ranking later only after enough history exists; current rule-based scoring is safer for production.
