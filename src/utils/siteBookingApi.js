import {isSupabaseConfigured, supabase} from "../lib/supabase.js";

const SITE_BOOKING_SELECT = [
  "id",
  "client_name",
  "client_phone",
  "client_email",
  "service_slug",
  "service_name",
  "preferred_date",
  "preferred_time",
  "preferred_master",
  "duration_minutes",
  "status",
  "note",
  "linked_calendar_entry_id",
  "created_at",
  "updated_at",
].join(", ");
const PENDING_SITE_BOOKINGS_LIMIT = 25;
const RECENT_SITE_BOOKINGS_LIMIT = 25;
const SITE_BOOKING_CACHE_TTL_MS = 60_000;

const requestCache = new Map();

const getCached = (key) => {
  const cached = requestCache.get(key);

  if (!cached || Date.now() - cached.cachedAt > SITE_BOOKING_CACHE_TTL_MS) {
    requestCache.delete(key);
    return null;
  }

  return cached.data;
};

const setCached = (key, data) => {
  requestCache.set(key, {cachedAt: Date.now(), data});
};

export const clearSiteBookingCache = () => {
  requestCache.clear();
};

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase не настроен");
  }

  return supabase;
};

export const fetchPendingSiteBookings = async () => {
  const cached = getCached("pending");

  if (cached) {
    return cached;
  }

  const client = ensureSupabase();
  const {data, error} = await client
    .from("site_booking_requests")
    .select(SITE_BOOKING_SELECT)
    .eq("status", "pending")
    .order("created_at", {ascending: false})
    .limit(PENDING_SITE_BOOKINGS_LIMIT);

  if (error) {
    throw error;
  }

  const requests = data ?? [];
  setCached("pending", requests);
  return requests;
};

export const fetchRecentSiteBookings = async ({limit = RECENT_SITE_BOOKINGS_LIMIT} = {}) => {
  const cacheKey = `recent:${limit}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return cached;
  }

  const client = ensureSupabase();
  const {data, error} = await client
    .from("site_booking_requests")
    .select(SITE_BOOKING_SELECT)
    .order("created_at", {ascending: false})
    .limit(limit);

  if (error) {
    throw error;
  }

  const requests = data ?? [];
  setCached(cacheKey, requests);
  return requests;
};

export const updateSiteBookingRequest = async (id, patch) => {
  const client = ensureSupabase();
  const {data, error} = await client
    .from("site_booking_requests")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SITE_BOOKING_SELECT)
    .single();

  if (error) {
    throw error;
  }

  clearSiteBookingCache();
  return data;
};

export const submitSiteBookingRequest = async (payload) => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase не настроен");
  }

  const response = await fetch(`${url}/functions/v1/site-booking-submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Не удалось отправить заявку");
  }

  return data;
};
