create table if not exists public.crm_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.crm_snapshots enable row level security;

drop policy if exists "Owners can read their CRM snapshot" on public.crm_snapshots;
create policy "Owners can read their CRM snapshot"
  on public.crm_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can create their CRM snapshot" on public.crm_snapshots;
create policy "Owners can create their CRM snapshot"
  on public.crm_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update their CRM snapshot" on public.crm_snapshots;
create policy "Owners can update their CRM snapshot"
  on public.crm_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete their CRM snapshot" on public.crm_snapshots;
create policy "Owners can delete their CRM snapshot"
  on public.crm_snapshots
  for delete
  using (auth.uid() = user_id);
