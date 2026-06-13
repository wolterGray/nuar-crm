-- Inactive client follow-up SMS: cron hook + audit table.
-- Configure Supabase Edge Function secrets:
--   SMSAPI_TOKEN
--   SMSAPI_SENDER (optional)
--   CRM_OWNER_USER_ID
--   INACTIVE_FOLLOW_UP_CRON_SECRET

create table if not exists public.inactive_follow_up_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null default 'process',
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.inactive_follow_up_runs enable row level security;

create policy "Owner can read inactive follow-up runs"
  on public.inactive_follow_up_runs
  for select
  using (auth.uid() = user_id);

create policy "Owner can insert inactive follow-up runs"
  on public.inactive_follow_up_runs
  for insert
  with check (auth.uid() = user_id);

comment on table public.inactive_follow_up_runs is
  'Optional audit trail for inactive client follow-up batches triggered from CRM or cron.';

-- Example external cron every hour:
-- POST https://<project>.supabase.co/functions/v1/inactive-client-follow-up
-- Headers: Authorization: Bearer <anon or service role>, x-cron-secret: <INACTIVE_FOLLOW_UP_CRON_SECRET>
-- Body: {"action":"cron"}
