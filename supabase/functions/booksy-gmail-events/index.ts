import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const {user, supabase} = await requireUser(request);
    const body =
      request.method === "POST"
        ? await request.json().catch(() => ({}))
        : {};
    const action = String(body.action ?? "dashboard");

    if (request.method === "GET" || action === "dashboard") {
      const statusResult = await supabase.rpc("get_google_connection_status");
      const {data: pendingEvents, error: pendingError} = await supabase
        .from("sync_extracted_events")
        .select(
          `
            *,
            sync_raw_messages (
              subject,
              from_address,
              received_at,
              parse_status,
              parse_error
            ),
            sync_match_candidates (*)
          `,
        )
        .eq("review_status", "pending")
        .order("created_at", {ascending: false});

      if (pendingError) {
        throw pendingError;
      }

      const {data: parseErrors, error: parseError} = await supabase
        .from("sync_raw_messages")
        .select("id, subject, from_address, received_at, parse_status, parse_error")
        .in("parse_status", ["error"])
        .order("received_at", {ascending: false})
        .limit(20);

      if (parseError) {
        throw parseError;
      }

      return jsonResponse({
        connection: statusResult.data?.[0] ?? null,
        pendingEvents: pendingEvents ?? [],
        parseErrors: parseErrors ?? [],
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({error: "Method not allowed"}, 405);
    }

    const eventId = String(body.eventId ?? "");
    const decision = String(body.action ?? "");
    const linkedCalendarEntryId = body.linkedCalendarEntryId
      ? String(body.linkedCalendarEntryId)
      : null;
    const details = body.details && typeof body.details === "object" ? body.details : {};

    if (!eventId || !decision) {
      return jsonResponse({error: "eventId and action are required"}, 400);
    }

    const reviewStatus =
      decision === "ignore"
        ? "ignored"
        : ["create", "update", "cancel", "link"].includes(decision)
          ? "applied"
          : "error";

    const admin = createAdminClient();

    const {error: updateError} = await admin
      .from("sync_extracted_events")
      .update({
        review_status: reviewStatus,
        linked_calendar_entry_id: linkedCalendarEntryId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    await admin.from("sync_import_logs").insert({
      user_id: user.id,
      extracted_event_id: eventId,
      action: decision,
      result:
        reviewStatus === "error"
          ? "error"
          : decision === "ignore"
            ? "skipped"
            : "success",
      details,
    });

    return jsonResponse({ok: true, reviewStatus});
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse(
      {error: error instanceof Error ? error.message : "Request failed"},
      500,
    );
  }
});
