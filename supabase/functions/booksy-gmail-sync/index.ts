import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {
  BOOKSY_GMAIL_QUERY,
  extractGmailBodies,
  getGmailHeader,
  isAppointmentDateInSyncWindow,
  parseBooksyGmailMessage,
} from "../_shared/booksyParser.ts";
import {matchExtractedEventToCalendar} from "../_shared/matching.ts";
import {
  ensureFreshAccessToken,
  fetchGmailMessage,
  listGmailMessages,
} from "../_shared/gmail.ts";

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  if (request.method !== "POST") {
    return jsonResponse({error: "Method not allowed"}, 405);
  }

  try {
    const {user} = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const employees = Array.isArray(body.employees) ? body.employees : [];
    const services = Array.isArray(body.services) ? body.services : [];
    const admin = createAdminClient();

    const {data: connection, error: connectionError} = await admin
      .from("google_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError || !connection?.refresh_token) {
      return jsonResponse({error: "Gmail is not connected"}, 400);
    }

    const {accessToken, expiresAt} = await ensureFreshAccessToken(connection);

    await admin
      .from("google_connections")
      .update({
        access_token: accessToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    const {data: snapshot} = await admin
      .from("crm_snapshots")
      .select("payload")
      .eq("user_id", user.id)
      .maybeSingle();

    const payload = (snapshot?.payload ?? {}) as Record<string, unknown>;
    const calendarEntries = Array.isArray(payload.calendarEntries)
      ? payload.calendarEntries
      : [];
    const clients = Array.isArray(payload.clients) ? payload.clients : [];

    const listed = await listGmailMessages(accessToken, BOOKSY_GMAIL_QUERY, 150);
    let processed = 0;
    let parsedCount = 0;
    let pendingCount = 0;
    let parseErrors = 0;

    for (const item of listed) {
      const messageId = item.id;
      const {data: existingRaw} = await admin
        .from("sync_raw_messages")
        .select("id, parse_status")
        .eq("user_id", user.id)
        .eq("gmail_message_id", messageId)
        .maybeSingle();

      if (
        existingRaw &&
        ["parsed", "skipped"].includes(existingRaw.parse_status)
      ) {
        continue;
      }

      processed += 1;

      try {
        const gmailMessage = await fetchGmailMessage(accessToken, messageId);
        const headers =
          ((gmailMessage.payload as Record<string, unknown>)?.headers ??
            []) as Array<{name?: string; value?: string}>;
        const fromAddress = getGmailHeader(headers, "From");
        const subject = getGmailHeader(headers, "Subject");
        const receivedAt = new Date(Number(gmailMessage.internalDate)).toISOString();
        const {bodyText, bodyHtml} = extractGmailBodies(
          (gmailMessage.payload ?? {}) as Record<string, unknown>,
        );

        const {data: rawRow, error: rawError} = await admin
          .from("sync_raw_messages")
          .upsert(
            {
              user_id: user.id,
              gmail_message_id: messageId,
              thread_id: String(gmailMessage.threadId ?? ""),
              from_address: fromAddress,
              subject,
              received_at: receivedAt,
              raw_payload: gmailMessage,
              body_text: bodyText,
              body_html: bodyHtml,
              parse_status: "pending",
              parse_error: null,
            },
            {onConflict: "user_id,gmail_message_id"},
          )
          .select("id")
          .single();

        if (rawError || !rawRow) {
          throw rawError ?? new Error("Failed to save raw message");
        }

        const {data: existingEvent} = await admin
          .from("sync_extracted_events")
          .select("id")
          .eq("raw_message_id", rawRow.id)
          .maybeSingle();

        if (existingEvent) {
          await admin
            .from("sync_raw_messages")
            .update({parse_status: "parsed"})
            .eq("id", rawRow.id);
          continue;
        }

        const extracted = parseBooksyGmailMessage(
          {
            subject,
            body_text: bodyText,
            from_address: fromAddress,
          },
          {employees, services},
        );

        if (!extracted) {
          await admin
            .from("sync_raw_messages")
            .update({parse_status: "skipped"})
            .eq("id", rawRow.id);
          continue;
        }

        if (!isAppointmentDateInSyncWindow(extracted.appointment_date)) {
          await admin
            .from("sync_raw_messages")
            .update({parse_status: "skipped"})
            .eq("id", rawRow.id);
          continue;
        }

        const matchResult = matchExtractedEventToCalendar(
          extracted,
          calendarEntries,
          clients,
        );

        const {data: eventRow, error: eventError} = await admin
          .from("sync_extracted_events")
          .insert({
            user_id: user.id,
            raw_message_id: rawRow.id,
            source: extracted.source,
            client_name: extracted.client_name,
            client_phone: extracted.client_phone,
            client_email: extracted.client_email,
            service_name: extracted.service_name,
            staff_name: extracted.staff_name,
            appointment_date: extracted.appointment_date,
            start_time: extracted.start_time,
            end_time: extracted.end_time,
            duration_minutes: extracted.duration_minutes,
            price: extracted.price,
            currency: extracted.currency,
            status: extracted.status,
            client_note: extracted.client_note,
            confidence_score: extracted.confidence_score,
            missing_fields: extracted.missing_fields,
            review_status: "pending",
            review_kind:
              extracted.confidence_score < 40
                ? "needs_review"
                : matchResult.reviewKind,
            linked_calendar_entry_id: matchResult.bestMatch?.calendar_entry_id ?? null,
          })
          .select("id")
          .single();

        if (eventError || !eventRow) {
          throw eventError ?? new Error("Failed to save extracted event");
        }

        if (matchResult.candidates.length > 0) {
          await admin.from("sync_match_candidates").insert(
            matchResult.candidates.map((candidate, index) => ({
              user_id: user.id,
              extracted_event_id: eventRow.id,
              calendar_entry_id: candidate.calendar_entry_id,
              match_score: candidate.match_score,
              match_reason: candidate.match_reason,
              is_recommended: index === 0,
            })),
          );
        }

        await admin
          .from("sync_raw_messages")
          .update({parse_status: "parsed"})
          .eq("id", rawRow.id);

        parsedCount += 1;
        pendingCount += 1;
      } catch (error) {
        parseErrors += 1;
        await admin
          .from("sync_raw_messages")
          .upsert(
            {
              user_id: user.id,
              gmail_message_id: messageId,
              from_address: "",
              subject: "",
              received_at: new Date().toISOString(),
              raw_payload: {},
              body_text: "",
              body_html: "",
              parse_status: "error",
              parse_error: error instanceof Error ? error.message : "Parse failed",
            },
            {onConflict: "user_id,gmail_message_id"},
          );
      }
    }

    await admin
      .from("google_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return jsonResponse({
      ok: true,
      scanned: listed.length,
      processed,
      parsed: parsedCount,
      pending: pendingCount,
      parseErrors,
    });
  } catch (error) {
    if (error instanceof Response) return error;

    try {
      const {user} = await requireUser(request);
      const admin = createAdminClient();
      await admin
        .from("google_connections")
        .update({
          last_sync_error: error instanceof Error ? error.message : "Sync failed",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch {
      // ignore secondary failure
    }

    return jsonResponse(
      {error: error instanceof Error ? error.message : "Sync failed"},
      500,
    );
  }
});
