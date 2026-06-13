import {createAdminClient} from "./supabaseAdmin.ts";

export const formatEdgeError = (error: unknown, fallback = "Request failed") => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as {message: unknown}).message);
  }

  return fallback;
};

export const loadPendingSiteBookings = async (
  admin: ReturnType<typeof createAdminClient>,
  {
    ownerUserId,
    preferredDate,
  }: {
    ownerUserId: string;
    preferredDate: string;
  },
) => {
  const {data, error} = await admin
    .from("site_booking_requests")
    .select("preferred_date, preferred_time, preferred_master, duration_minutes, status")
    .eq("owner_user_id", ownerUserId)
    .eq("status", "pending")
    .eq("preferred_date", preferredDate);

  if (error) {
    const message = formatEdgeError(error);

    if (message.includes("site_booking_requests")) {
      return [];
    }

    throw error;
  }

  return data ?? [];
};
