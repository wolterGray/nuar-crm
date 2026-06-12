import {
  BOOKSY_GMAIL_QUERY,
  parseBooksyGmailMessage,
} from "./booksyGmailParser.js";
import {matchExtractedEventToCalendar} from "./matching.js";
import {syncGmailMessages} from "../gmail.js";

const toPendingEvent = (email, extracted, matchResult) => ({
  id: `local-${email.id}`,
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
  review_kind: matchResult.reviewKind,
  review_status: "pending",
  gmail_message_id: email.id,
  sync_raw_messages: {
    gmail_message_id: email.id,
    subject: email.subject,
    from_address: email.from,
    received_at: email.receivedAt,
  },
  sync_match_candidates: matchResult.candidates.map((candidate, index) => ({
    calendar_entry_id: candidate.calendar_entry_id,
    match_score: candidate.match_score,
    match_reason: candidate.match_reason,
    is_recommended: index === 0,
  })),
  linked_calendar_entry_id: matchResult.bestMatch?.calendar_entry_id ?? null,
});

export const syncBooksyGmailClient = async ({
  calendarEntries,
  clientProfiles,
  employees,
  gmailAccessToken,
  gmailClientId,
  services,
  skippedMessageIds = [],
}) => {
  const emails = await syncGmailMessages(
    gmailClientId,
    gmailAccessToken,
    BOOKSY_GMAIL_QUERY,
  );
  const skipped = new Set(skippedMessageIds);
  const pendingEvents = [];
  const parseErrors = [];

  emails.forEach((email) => {
    if (skipped.has(email.id)) {
      return;
    }

    try {
      const extracted = parseBooksyGmailMessage(
        {
          subject: email.subject,
          body_text: email.text,
          from_address: email.from,
        },
        {employees, services},
      );

      if (!extracted) {
        return;
      }

      const matchResult = matchExtractedEventToCalendar(
        extracted,
        calendarEntries,
        clientProfiles,
      );

      pendingEvents.push(toPendingEvent(email, extracted, matchResult));
    } catch (error) {
      parseErrors.push({
        id: email.id,
        subject: email.subject,
        from_address: email.from,
        received_at: email.receivedAt,
        parse_status: "error",
        parse_error: error instanceof Error ? error.message : "Parse failed",
      });
    }
  });

  return {
    pendingEvents,
    parseErrors,
    scanned: emails.length,
  };
};

export const buildClientGmailConnection = ({
  gmailAccessToken,
  gmailClientId,
  googleEmail = "",
  lastSyncAt = null,
}) => ({
  is_connected: Boolean(gmailAccessToken || gmailClientId?.trim()),
  google_email: googleEmail,
  last_sync_at: lastSyncAt,
  last_sync_error: null,
  mode: "client",
});
