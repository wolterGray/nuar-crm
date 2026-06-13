import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {loadCrmSnapshotForSiteBooking} from "../_shared/crmSnapshot.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {buildBookableSlots} from "../_shared/siteBookingSlots.ts";

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  if (request.method !== "POST") {
    return jsonResponse({error: "Method not allowed"}, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const preferredDate = String(body.preferredDate ?? body.preferred_date ?? "").trim();
    const durationMinutes = Math.max(
      15,
      Number(body.durationMinutes ?? body.duration_minutes) || 60,
    );
    const preferredMaster = String(
      body.preferredMaster ?? body.preferred_master ?? "",
    ).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return jsonResponse({error: "preferredDate must be YYYY-MM-DD"}, 400);
    }

    const admin = createAdminClient();
    const {ownerUserId, payload} = await loadCrmSnapshotForSiteBooking(admin);
    const {data: pendingBookings, error: pendingError} = await admin
      .from("site_booking_requests")
      .select("preferred_date, preferred_time, preferred_master, duration_minutes, status")
      .eq("owner_user_id", ownerUserId)
      .eq("status", "pending")
      .eq("preferred_date", preferredDate);

    if (pendingError) {
      throw pendingError;
    }

    const slots = buildBookableSlots({
      appSettings: payload.settings ?? {},
      calendarEntries: payload.calendarEntries ?? [],
      date: preferredDate,
      durationMinutes,
      employees: payload.employees ?? [],
      pendingBookings: pendingBookings ?? [],
      preferredMaster,
    });

    return jsonResponse({
      configured: true,
      date: preferredDate,
      durationMinutes,
      slots,
    });
  } catch (error) {
    return jsonResponse(
      {error: error instanceof Error ? error.message : "Availability failed"},
      500,
    );
  }
});
