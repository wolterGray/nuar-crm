import {isSupabaseConfigured, supabase} from "../../lib/supabase.js";

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase не настроен");
  }

  return supabase;
};

const parseInvokeError = async (error, fallback) => {
  if (!error) {
    return fallback;
  }

  try {
    const response = error.context;
    if (response instanceof Response) {
      const body = await response.clone().json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    }
  } catch {
    // ignore
  }

  return String(error.message || fallback);
};

const invokeFunction = async (name, body) => {
  const client = ensureSupabase();
  const {data, error} = await client.functions.invoke(name, {body});

  if (error) {
    throw new Error(await parseInvokeError(error, `Не удалось вызвать ${name}`));
  }

  return data;
};

export const areBooksyGmailFunctionsAvailable = async () => {
  if (!isSupabaseConfigured) {
    return false;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await fetch(`${url}/functions/v1/booksy-gmail-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({action: "dashboard"}),
    });

    return response.status !== 404;
  } catch {
    return false;
  }
};

export const fetchBooksyGmailDashboard = async () => {
  const data = await invokeFunction("booksy-gmail-events", {action: "dashboard"});
  return data ?? {connection: null, pendingEvents: [], parseErrors: []};
};

export const startBooksyGmailOAuth = async (returnUrl = window.location.href) => {
  const data = await invokeFunction("booksy-gmail-oauth", {action: "start", returnUrl});

  if (!data?.authUrl) {
    throw new Error("Google OAuth URL не получен");
  }

  return data.authUrl;
};

export const disconnectBooksyGmail = async () => {
  await invokeFunction("booksy-gmail-oauth", {action: "disconnect"});
};

export const runBooksyGmailSync = async ({employees = [], services = []} = {}) => {
  const data = await invokeFunction("booksy-gmail-sync", {employees, services});
  return {data, error: null};
};

export const logBooksyGmailDecision = async ({
  eventId,
  action,
  linkedCalendarEntryId = null,
  details = {},
}) =>
  invokeFunction("booksy-gmail-events", {
    eventId,
    action,
    linkedCalendarEntryId,
    details,
  });
