import {supabase, isSupabaseConfigured} from "../../lib/supabase.js";

const mapRpcError = (error) => {
  if (!error) {
    return "Не удалось создать задачу Booksy";
  }

  return error.message || error.details || "Не удалось создать задачу Booksy";
};

export const enqueueBooksySyncJob = async (calendarEntryId) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Подключите Supabase, чтобы отправить визит в Booksy");
  }

  const {data, error} = await supabase.rpc("enqueue_booksy_sync_job", {
    p_calendar_entry_id: String(calendarEntryId),
  });

  if (error) {
    throw new Error(mapRpcError(error));
  }

  return data ?? {ok: false};
};

export const retryBooksySyncJob = async (calendarEntryId) => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Подключите Supabase, чтобы повторить отправку в Booksy");
  }

  const {data, error} = await supabase.rpc("retry_booksy_sync_job", {
    p_calendar_entry_id: String(calendarEntryId),
  });

  if (error) {
    throw new Error(mapRpcError(error));
  }

  return data ?? {ok: false};
};
