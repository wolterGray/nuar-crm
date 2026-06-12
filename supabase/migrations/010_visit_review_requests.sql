-- Visit review requests: cron hook + audit table.
-- Configure Supabase Edge Function secrets:
--   SMSAPI_TOKEN
--   SMSAPI_SENDER (optional)
--   CRM_OWNER_USER_ID
--   VISIT_REVIEW_CRON_SECRET

create table if not exists public.review_request_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null default 'process',
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.review_request_runs enable row level security;

create policy "Owner can read review request runs"
  on public.review_request_runs
  for select
  using (auth.uid() = user_id);

create policy "Owner can insert review request runs"
  on public.review_request_runs
  for insert
  with check (auth.uid() = user_id);

comment on table public.review_request_runs is
  'Optional audit trail for post-visit review request batches triggered from CRM or cron.';

-- Example external cron every 15 minutes:
-- POST https://<project>.supabase.co/functions/v1/visit-review-requests
-- Headers: Authorization: Bearer <anon or service role>, x-cron-secret: <VISIT_REVIEW_CRON_SECRET>
-- Body: {"action":"cron"}
