import {isSupabaseConfigured, supabase} from "../lib/supabase.js";

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase не настроен");
  }

  return supabase;
};

export const fetchPendingSiteBookings = async () => {
  const client = ensureSupabase();
  const {data, error} = await client
    .from("site_booking_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", {ascending: false});

  if (error) {
    throw error;
  }

  return data ?? [];
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
    .select("*")
    .single();

  if (error) {
    throw error;
  }

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
