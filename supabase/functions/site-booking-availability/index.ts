import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {loadCrmSnapshotForSiteBooking} from "../_shared/crmSnapshot.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {formatEdgeError, loadPendingSiteBookings} from "../_shared/siteBookingRequests.ts";
import {attachPricingToSlots} from "../_shared/siteBookingPricing.ts";
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
    const serviceSlug = String(body.serviceSlug ?? body.service_slug ?? "").trim();
    const serviceName = String(body.serviceName ?? body.service_name ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return jsonResponse({error: "preferredDate must be YYYY-MM-DD"}, 400);
    }

    const admin = createAdminClient();
    const {ownerUserId, payload} = await loadCrmSnapshotForSiteBooking(admin, {
      cacheTtlMs: 30_000,
    });
    const pendingBookings = await loadPendingSiteBookings(admin, {
      ownerUserId,
      preferredDate,
    });

    const bookableSlots = buildBookableSlots({
      appSettings: payload.settings ?? {},
      calendarEntries: payload.calendarEntries ?? [],
      date: preferredDate,
      durationMinutes,
      employees: payload.employees ?? [],
      pendingBookings: pendingBookings ?? [],
      preferredMaster,
      serviceCatalog: payload.services ?? [],
      serviceName,
      serviceSlug,
    });
    const slots = attachPricingToSlots({
      date: preferredDate,
      durationMinutes,
      employees: payload.employees ?? [],
      serviceCatalog: payload.services ?? [],
      serviceName,
      serviceSlug,
      slots: bookableSlots,
    });

    return jsonResponse({
      configured: true,
      date: preferredDate,
      durationMinutes,
      slots,
    });
  } catch (error) {
    return jsonResponse({error: formatEdgeError(error, "Availability failed")}, 500);
  }
});
