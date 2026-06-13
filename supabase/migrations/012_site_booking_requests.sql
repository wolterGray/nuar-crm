-- Site booking requests: public form on nuarr.pl → CRM calendar import

create table if not exists public.site_booking_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_phone text not null default '',
  client_email text not null default '',
  service_slug text not null default '',
  service_name text not null default '',
  preferred_master text not null default '',
  preferred_date date not null,
  preferred_time time not null,
  duration_minutes integer not null default 60,
  note text not null default '',
  locale text not null default 'pl',
  status text not null default 'pending'
    check (status in ('pending', 'rejected', 'applied')),
  linked_calendar_entry_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists site_booking_requests_owner_status_idx
  on public.site_booking_requests (owner_user_id, status, created_at desc);

alter table public.site_booking_requests enable row level security;

create policy site_booking_requests_select_own
  on public.site_booking_requests
  for select
  to authenticated
  using (auth.uid() = owner_user_id);

create policy site_booking_requests_update_own
  on public.site_booking_requests
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Public inserts go through Edge Function with service role only.

comment on table public.site_booking_requests is
  'Online booking requests from nuarr.pl; CRM owner imports into calendarEntries.';
