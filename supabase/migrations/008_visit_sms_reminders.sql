-- SMS visit reminders: optional cron hook + audit table.
-- Configure Supabase Edge Function secrets:
--   SMSAPI_TOKEN
--   SMSAPI_SENDER (optional, e.g. NUAR)
--   CRM_OWNER_USER_ID (auth.users id of CRM owner for cron)
--   VISIT_SMS_CRON_SECRET (shared secret for scheduled calls)

create table if not exists public.sms_reminder_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null default 'process',
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.sms_reminder_runs enable row level security;

create policy "Owner can read sms reminder runs"
  on public.sms_reminder_runs
  for select
  using (auth.uid() = user_id);

create policy "Owner can insert sms reminder runs"
  on public.sms_reminder_runs
  for insert
  with check (auth.uid() = user_id);

comment on table public.sms_reminder_runs is
  'Optional audit trail for visit SMS reminder batches triggered from CRM or cron.';

-- Example external cron (GitHub Actions / cron-job.org) every 15 minutes:
-- POST https://<project>.supabase.co/functions/v1/visit-sms-reminders
-- Headers: Authorization: Bearer <anon or service role>, x-cron-secret: <VISIT_SMS_CRON_SECRET>
-- Body: {"action":"cron","process":true}
-- Then call process in edge function - extend action if needed.
