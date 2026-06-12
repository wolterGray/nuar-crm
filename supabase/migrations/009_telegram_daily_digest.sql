-- Telegram daily digest: cron hook + audit table.
-- Configure Supabase Edge Function secrets:
--   TELEGRAM_BOT_TOKEN
--   TELEGRAM_CHAT_ID
--   CRM_OWNER_USER_ID (auth.users id of CRM owner for cron)
--   TELEGRAM_DIGEST_CRON_SECRET (shared secret for scheduled calls)

create table if not exists public.telegram_digest_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null default 'process',
  message_length integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.telegram_digest_runs enable row level security;

create policy "Owner can read telegram digest runs"
  on public.telegram_digest_runs
  for select
  using (auth.uid() = user_id);

create policy "Owner can insert telegram digest runs"
  on public.telegram_digest_runs
  for insert
  with check (auth.uid() = user_id);

comment on table public.telegram_digest_runs is
  'Optional audit trail for daily Telegram digest sends triggered from CRM or cron.';

-- Example external cron every hour (function skips if not the configured time):
-- POST https://<project>.supabase.co/functions/v1/telegram-daily-digest
-- Headers: Authorization: Bearer <anon or service role>, x-cron-secret: <TELEGRAM_DIGEST_CRON_SECRET>
-- Body: {"action":"cron"}
