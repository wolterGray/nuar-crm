-- Booksy Gmail Sync module (server-side Gmail, review before import)

create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null default '',
  access_token text,
  refresh_token text not null,
  token_expires_at timestamptz,
  scopes text not null default 'https://www.googleapis.com/auth/gmail.readonly',
  status text not null default 'active'
    check (status in ('active', 'revoked', 'error')),
  connected_at timestamptz not null default timezone('utc'::text, now()),
  last_sync_at timestamptz,
  last_sync_error text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.sync_raw_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  from_address text not null default '',
  subject text not null default '',
  received_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  body_text text not null default '',
  body_html text not null default '',
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'parsed', 'skipped', 'error')),
  parse_error text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, gmail_message_id)
);

create index if not exists sync_raw_messages_user_received_idx
  on public.sync_raw_messages (user_id, received_at desc);

create table if not exists public.sync_extracted_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_message_id uuid not null references public.sync_raw_messages(id) on delete cascade,
  source text not null default 'booksy_gmail',
  client_name text not null default '',
  client_phone text not null default '',
  client_email text not null default '',
  service_name text not null default '',
  staff_name text not null default '',
  appointment_date date,
  start_time time,
  end_time time,
  duration_minutes integer,
  price numeric(12, 2),
  currency text not null default 'PLN',
  status text not null default 'new'
    check (status in ('new', 'changed', 'cancelled', 'confirmed')),
  client_note text not null default '',
  confidence_score integer not null default 0
    check (confidence_score >= 0 and confidence_score <= 100),
  missing_fields jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'ignored', 'applied', 'error')),
  review_kind text not null default 'needs_review'
    check (review_kind in (
      'new_visit',
      'possible_duplicate',
      'visit_update',
      'visit_cancel',
      'needs_review',
      'parse_error'
    )),
  linked_calendar_entry_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sync_extracted_events_user_review_idx
  on public.sync_extracted_events (user_id, review_status, created_at desc);

create table if not exists public.sync_match_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  extracted_event_id uuid not null references public.sync_extracted_events(id) on delete cascade,
  calendar_entry_id text not null,
  match_score integer not null default 0
    check (match_score >= 0 and match_score <= 100),
  match_reason text not null default '',
  is_recommended boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sync_match_candidates_event_idx
  on public.sync_match_candidates (extracted_event_id, match_score desc);

create table if not exists public.sync_import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  extracted_event_id uuid references public.sync_extracted_events(id) on delete set null,
  action text not null,
  result text not null default 'success'
    check (result in ('success', 'error', 'skipped')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.get_google_connection_status()
returns table (
  user_id uuid,
  google_email text,
  status text,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_sync_error text,
  is_connected boolean
)
language sql
security definer
set search_path = public
as $$
  select
    gc.user_id,
    gc.google_email,
    gc.status,
    gc.connected_at,
    gc.last_sync_at,
    gc.last_sync_error,
    (gc.refresh_token is not null and gc.refresh_token <> '') as is_connected
  from public.google_connections gc
  where gc.user_id = auth.uid();
$$;

grant execute on function public.get_google_connection_status() to authenticated;

alter table public.google_connections enable row level security;
alter table public.sync_raw_messages enable row level security;
alter table public.sync_extracted_events enable row level security;
alter table public.sync_match_candidates enable row level security;
alter table public.sync_import_logs enable row level security;

-- Tokens are server-only: users see status via RPC, not raw table.
revoke all on public.google_connections from anon, authenticated;
grant all on public.google_connections to service_role;

create policy "Users read own sync raw messages"
  on public.sync_raw_messages for select
  using (auth.uid() = user_id);

create policy "Users read own extracted events"
  on public.sync_extracted_events for select
  using (auth.uid() = user_id);

create policy "Users update own extracted events review fields"
  on public.sync_extracted_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read own match candidates"
  on public.sync_match_candidates for select
  using (auth.uid() = user_id);

create policy "Users read own import logs"
  on public.sync_import_logs for select
  using (auth.uid() = user_id);

grant all on public.sync_raw_messages to service_role;
grant all on public.sync_extracted_events to service_role;
grant all on public.sync_match_candidates to service_role;
grant all on public.sync_import_logs to service_role;
grant select, update on public.sync_extracted_events to authenticated;
grant select on public.sync_raw_messages to authenticated;
grant select on public.sync_match_candidates to authenticated;
grant select on public.sync_import_logs to authenticated;
grant insert on public.sync_import_logs to authenticated;
