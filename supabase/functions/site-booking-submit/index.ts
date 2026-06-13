import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {
  isBookableSlotAvailable,
} from "../_shared/siteBookingSlots.ts";
import {notifyOwnerAboutSiteBooking} from "../_shared/siteBookingNotify.ts";

const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidTime = (value: string) => /^\d{2}:\d{2}(:\d{2})?$/.test(value);

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  if (request.method !== "POST") {
    return jsonResponse({error: "Method not allowed"}, 405);
  }

  try {
    const ownerUserId = String(Deno.env.get("CRM_OWNER_USER_ID") ?? "").trim();

    if (!ownerUserId) {
      return jsonResponse({error: "CRM_OWNER_USER_ID is not configured"}, 500);
    }

    const body = await request.json().catch(() => ({}));
    const clientName = String(body.clientName ?? body.client_name ?? "").trim();
    const clientPhone = normalizePhone(body.clientPhone ?? body.client_phone);
    const clientEmail = String(body.clientEmail ?? body.client_email ?? "").trim();
    const serviceSlug = String(body.serviceSlug ?? body.service_slug ?? "").trim();
    const serviceName = String(body.serviceName ?? body.service_name ?? "").trim();
    const preferredMaster = String(
      body.preferredMaster ?? body.preferred_master ?? "",
    ).trim();
    const preferredDate = String(body.preferredDate ?? body.preferred_date ?? "").trim();
    const preferredTime = String(body.preferredTime ?? body.preferred_time ?? "").trim();
    const durationMinutes = Math.max(
      15,
      Number(body.durationMinutes ?? body.duration_minutes) || 60,
    );
    const note = String(body.note ?? "").trim().slice(0, 500);
    const locale = String(body.locale ?? "pl").trim().slice(0, 8);

    if (clientName.length < 2) {
      return jsonResponse({error: "clientName is required"}, 400);
    }

    if (clientPhone.length < 9) {
      return jsonResponse({error: "clientPhone is required"}, 400);
    }

    if (!serviceName) {
      return jsonResponse({error: "serviceName is required"}, 400);
    }

    if (!isValidDate(preferredDate)) {
      return jsonResponse({error: "preferredDate must be YYYY-MM-DD"}, 400);
    }

    if (!isValidTime(preferredTime)) {
      return jsonResponse({error: "preferredTime must be HH:MM"}, 400);
    }

    const today = new Date().toISOString().slice(0, 10);

    if (preferredDate < today) {
      return jsonResponse({error: "preferredDate cannot be in the past"}, 400);
    }

    const admin = createAdminClient();
    const {data: snapshotRow, error: snapshotError} = await admin
      .from("crm_snapshots")
      .select("payload")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (snapshotError) {
      throw snapshotError;
    }

    const payload = (snapshotRow?.payload ?? {}) as {
      calendarEntries?: Array<Record<string, unknown>>;
      employees?: Array<Record<string, unknown>>;
      settings?: Record<string, unknown>;
    };

    const {data: pendingBookings, error: pendingError} = await admin
      .from("site_booking_requests")
      .select("preferred_date, preferred_time, preferred_master, duration_minutes, status")
      .eq("owner_user_id", ownerUserId)
      .eq("status", "pending")
      .eq("preferred_date", preferredDate);

    if (pendingError) {
      throw pendingError;
    }

    const slotAvailable = isBookableSlotAvailable({
      appSettings: payload.settings ?? {},
      calendarEntries: payload.calendarEntries ?? [],
      date: preferredDate,
      durationMinutes,
      employees: payload.employees ?? [],
      pendingBookings: pendingBookings ?? [],
      preferredMaster,
      preferredTime,
    });

    if (!slotAvailable) {
      return jsonResponse({error: "Selected time is no longer available"}, 409);
    }

    const timeValue = preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime;
    const {data, error} = await admin
      .from("site_booking_requests")
      .insert({
        client_email: clientEmail,
        client_name: clientName,
        client_phone: clientPhone,
        duration_minutes: durationMinutes,
        locale,
        note,
        owner_user_id: ownerUserId,
        preferred_date: preferredDate,
        preferred_master: preferredMaster,
        preferred_time: timeValue,
        service_name: serviceName,
        service_slug: serviceSlug,
        status: "pending",
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    await notifyOwnerAboutSiteBooking({
      appSettings: payload.settings ?? {},
      booking: {
        clientEmail,
        clientName,
        clientPhone,
        durationMinutes,
        note,
        preferredDate,
        preferredMaster,
        preferredTime: preferredTime.slice(0, 5),
        serviceName,
      },
    }).catch(() => ({}));

    return jsonResponse({
      id: data.id,
      createdAt: data.created_at,
      ok: true,
    });
  } catch (error) {
    return jsonResponse(
      {error: error instanceof Error ? error.message : "Submit failed"},
      500,
    );
  }
});
