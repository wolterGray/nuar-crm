-- Remove CRM → Booksy Playwright worker (outbound sync).
-- Run once in Supabase SQL Editor after stopping the worker process.

drop trigger if exists booksy_sync_jobs_updated_at on public.booksy_sync_jobs;
drop function if exists public.booksy_touch_job_updated_at();

drop function if exists public.list_booksy_verification_targets(integer);
drop function if exists public.report_booksy_sync_removed(uuid, text, text);
drop function if exists public.touch_booksy_sync_verified(uuid, text);

drop function if exists public.finish_booksy_sync_job(uuid, boolean, text, text, text, text);
drop function if exists public.finish_booksy_sync_job(uuid, boolean, text, text, text);
drop function if exists public.claim_booksy_sync_jobs(text, integer);
drop function if exists public.retry_booksy_sync_job(text);
drop function if exists public.enqueue_booksy_sync_job(text);
drop function if exists public.booksy_replace_calendar_entry(jsonb, text, jsonb);
drop function if exists public.booksy_find_calendar_entry(jsonb, text);

drop table if exists public.booksy_sync_jobs;

-- Optional: strip outbound Booksy fields from calendar entries in CRM payload.
update public.crm_snapshots
set payload = jsonb_set(
      payload,
      '{calendarEntries}',
      coalesce(
        (
          select jsonb_agg(
            entry
            - 'booksySyncStatus'
            - 'booksySyncError'
            - 'booksySyncedAt'
            - 'booksyVerifiedAt'
            - 'booksyLastVerifiedAt'
            - 'booksyLastAttemptAt'
            - 'booksyRetryCount'
            - 'booksyExternalId'
            - 'booksyLockedAt'
            - 'booksySyncFingerprint'
          )
          from jsonb_array_elements(coalesce(payload->'calendarEntries', '[]'::jsonb)) as entry
        ),
        '[]'::jsonb
      ),
      true
    ),
    updated_at = timezone('utc'::text, now())
where jsonb_typeof(payload->'calendarEntries') = 'array';
