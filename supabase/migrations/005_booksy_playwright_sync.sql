-- CRM → Booksy outbound sync (Playwright worker queue)
--
-- Architecture:
--   • Calendar visits live in crm_snapshots.payload.calendarEntries (JSON).
--   • booksy_sync_jobs is the worker queue (service role + Playwright).
--   • Sync status fields are duplicated on calendar entry objects for CRM UI.
--   • Worker claims jobs, runs Playwright, then calls finish_booksy_sync_job().

create table if not exists public.booksy_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_entry_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  booksy_external_id text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create index if not exists booksy_sync_jobs_status_created_idx
  on public.booksy_sync_jobs (status, created_at asc);

create index if not exists booksy_sync_jobs_user_entry_idx
  on public.booksy_sync_jobs (user_id, calendar_entry_id, created_at desc);

-- Prevent duplicate active jobs for the same calendar entry.
create unique index if not exists booksy_sync_jobs_active_entry_uidx
  on public.booksy_sync_jobs (user_id, calendar_entry_id)
  where status in ('queued', 'processing');

alter table public.booksy_sync_jobs enable row level security;

create policy booksy_sync_jobs_select_own
  on public.booksy_sync_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts/updates from CRM UI go through SECURITY DEFINER RPC functions.
-- Worker uses service role (bypasses RLS).

create or replace function public.booksy_touch_job_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists booksy_sync_jobs_updated_at on public.booksy_sync_jobs;
create trigger booksy_sync_jobs_updated_at
  before update on public.booksy_sync_jobs
  for each row execute function public.booksy_touch_job_updated_at();

-- Helper: find calendar entry object inside snapshot payload.
create or replace function public.booksy_find_calendar_entry(
  p_payload jsonb,
  p_calendar_entry_id text
)
returns jsonb
language sql
immutable
as $$
  select entry
  from jsonb_array_elements(coalesce(p_payload->'calendarEntries', '[]'::jsonb)) as entry
  where entry->>'id' = p_calendar_entry_id
  limit 1;
$$;

create or replace function public.booksy_replace_calendar_entry(
  p_payload jsonb,
  p_calendar_entry_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_entries jsonb := coalesce(p_payload->'calendarEntries', '[]'::jsonb);
  v_result jsonb := '[]'::jsonb;
  v_entry jsonb;
begin
  for v_entry in select value from jsonb_array_elements(v_entries) as t(value)
  loop
    if v_entry->>'id' = p_calendar_entry_id then
      v_result := v_result || (v_entry || p_patch);
    else
      v_result := v_result || v_entry;
    end if;
  end loop;

  return jsonb_set(p_payload, '{calendarEntries}', v_result, true);
end;
$$;

create or replace function public.enqueue_booksy_sync_job(p_calendar_entry_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.crm_snapshots%rowtype;
  v_entry jsonb;
  v_status text;
  v_job_id uuid;
  v_job_payload jsonb;
  v_client jsonb;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_calendar_entry_id), '') = '' then
    raise exception 'calendar_entry_id is required';
  end if;

  select * into v_snapshot
  from public.crm_snapshots
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'CRM snapshot not found';
  end if;

  v_entry := public.booksy_find_calendar_entry(v_snapshot.payload, p_calendar_entry_id);

  if v_entry is null then
    raise exception 'Calendar entry not found';
  end if;

  if coalesce(v_entry->>'kind', 'visit') <> 'visit' then
    raise exception 'Only visit entries can be sent to Booksy';
  end if;

  v_status := coalesce(v_entry->>'booksySyncStatus', 'not_sent');

  if v_status in ('pending', 'synced') then
    raise exception 'Visit already pending or synced with Booksy (status=%)', v_status;
  end if;

  if coalesce(v_entry->>'date', '') = ''
     or coalesce(v_entry->>'time', '') = ''
     or coalesce(v_entry->>'master', '') = ''
     or coalesce(v_entry->>'duration', '') = '' then
    raise exception 'Visit must have date, time, master and duration';
  end if;

  v_client := (
    select client
    from jsonb_array_elements(coalesce(v_snapshot.payload->'clients', '[]'::jsonb)) as client
    where client->>'id' = coalesce(v_entry->>'clientId', '')
    limit 1
  );

  v_job_payload := jsonb_build_object(
    'calendarEntryId', p_calendar_entry_id,
    'clientName', coalesce(v_entry->>'client', ''),
    'clientPhone', coalesce(v_client->>'phone', ''),
    'clientEmail', coalesce(v_client->>'email', ''),
    'serviceName', coalesce(v_entry->>'service', ''),
    'masterName', coalesce(v_entry->>'master', ''),
    'date', v_entry->>'date',
    'time', v_entry->>'time',
    'durationMinutes', coalesce(v_entry->>'duration', '60')::integer,
    'note', coalesce(v_entry->>'note', ''),
    'amount', coalesce(v_entry->>'amount', '0')
  );

  insert into public.booksy_sync_jobs (
    user_id,
    calendar_entry_id,
    status,
    payload,
    attempts,
    max_attempts
  ) values (
    v_user_id,
    p_calendar_entry_id,
    'queued',
    v_job_payload,
    0,
    3
  )
  returning id into v_job_id;

  v_snapshot.payload := public.booksy_replace_calendar_entry(
    v_snapshot.payload,
    p_calendar_entry_id,
    jsonb_build_object(
      'booksySyncStatus', 'pending',
      'booksySyncError', '',
      'booksyLastAttemptAt', v_now,
      'booksyLockedAt', v_now
    )
  );

  update public.crm_snapshots
  set payload = v_snapshot.payload,
      updated_at = v_now
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'jobId', v_job_id,
    'booksySyncStatus', 'pending'
  );
end;
$$;

revoke all on function public.enqueue_booksy_sync_job(text) from public;
grant execute on function public.enqueue_booksy_sync_job(text) to authenticated;

create or replace function public.retry_booksy_sync_job(p_calendar_entry_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.crm_snapshots%rowtype;
  v_entry jsonb;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_snapshot
  from public.crm_snapshots
  where user_id = v_user_id
  for update;

  v_entry := public.booksy_find_calendar_entry(v_snapshot.payload, p_calendar_entry_id);
  if v_entry is null then
    raise exception 'Calendar entry not found';
  end if;

  v_status := coalesce(v_entry->>'booksySyncStatus', 'not_sent');
  if v_status <> 'failed' then
    raise exception 'Retry is only allowed for failed visits';
  end if;

  v_snapshot.payload := public.booksy_replace_calendar_entry(
    v_snapshot.payload,
    p_calendar_entry_id,
    jsonb_build_object(
      'booksySyncStatus', 'not_sent',
      'booksySyncError', ''
    )
  );

  update public.crm_snapshots
  set payload = v_snapshot.payload,
      updated_at = timezone('utc'::text, now())
  where user_id = v_user_id;

  return public.enqueue_booksy_sync_job(p_calendar_entry_id);
end;
$$;

revoke all on function public.retry_booksy_sync_job(text) from public;
grant execute on function public.retry_booksy_sync_job(text) to authenticated;

-- Worker-only helpers (service role).
create or replace function public.claim_booksy_sync_jobs(
  p_worker_id text,
  p_limit integer default 1
)
returns setof public.booksy_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select id
    from public.booksy_sync_jobs
    where status = 'queued'
      and attempts < max_attempts
    order by created_at asc
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.booksy_sync_jobs jobs
  set status = 'processing',
      locked_at = timezone('utc'::text, now()),
      locked_by = p_worker_id,
      attempts = jobs.attempts + 1
  from next_jobs
  where jobs.id = next_jobs.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_booksy_sync_jobs(text, integer) from public;
grant execute on function public.claim_booksy_sync_jobs(text, integer) to service_role;

create or replace function public.finish_booksy_sync_job(
  p_job_id uuid,
  p_success boolean,
  p_error_message text default null,
  p_booksy_external_id text default null,
  p_worker_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.booksy_sync_jobs%rowtype;
  v_snapshot public.crm_snapshots%rowtype;
  v_now timestamptz := timezone('utc'::text, now());
  v_entry_status text;
  v_patch jsonb;
begin
  select * into v_job
  from public.booksy_sync_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found';
  end if;

  if v_job.status <> 'processing' then
    raise exception 'Job is not processing';
  end if;

  if p_worker_id is not null and v_job.locked_by is distinct from p_worker_id then
    raise exception 'Job locked by another worker';
  end if;

  select * into v_snapshot
  from public.crm_snapshots
  where user_id = v_job.user_id
  for update;

  if p_success then
    update public.booksy_sync_jobs
    set status = 'done',
        error_message = null,
        booksy_external_id = coalesce(p_booksy_external_id, booksy_external_id),
        completed_at = v_now,
        locked_at = null,
        locked_by = null
    where id = p_job_id;

    v_entry_status := 'synced';
    v_patch := jsonb_build_object(
      'booksySyncStatus', 'synced',
      'booksySyncError', '',
      'booksySyncedAt', v_now,
      'booksyLastAttemptAt', v_now,
      'booksyExternalId', coalesce(p_booksy_external_id, ''),
      'booksyLockedAt', null
    );
  else
    update public.booksy_sync_jobs
    set status = case
          when attempts >= max_attempts then 'failed'
          else 'queued'
        end,
        error_message = coalesce(p_error_message, 'Unknown worker error'),
        completed_at = case when attempts >= max_attempts then v_now else null end,
        locked_at = null,
        locked_by = null
    where id = p_job_id;

    v_entry_status := case when v_job.attempts >= v_job.max_attempts then 'failed' else 'retrying' end;
    v_patch := jsonb_build_object(
      'booksySyncStatus', v_entry_status,
      'booksySyncError', coalesce(p_error_message, 'Unknown worker error'),
      'booksyLastAttemptAt', v_now,
      'booksyRetryCount', v_job.attempts,
      'booksyLockedAt', null
    );
  end if;

  if v_snapshot.user_id is not null then
    v_snapshot.payload := public.booksy_replace_calendar_entry(
      v_snapshot.payload,
      v_job.calendar_entry_id,
      v_patch
    );

    update public.crm_snapshots
    set payload = v_snapshot.payload,
        updated_at = v_now
    where user_id = v_job.user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'jobId', p_job_id,
    'booksySyncStatus', v_entry_status
  );
end;
$$;

revoke all on function public.finish_booksy_sync_job(uuid, boolean, text, text, text) from public;
grant execute on function public.finish_booksy_sync_job(uuid, boolean, text, text, text) to service_role;
