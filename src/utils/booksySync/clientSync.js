import {
  GMAIL_SYNC_QUERIES,
  parseBooksyGmailMessage,
} from "./booksyGmailParser.js";
import {parseImportDocument} from "./invoiceParser.js";
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
  importDocuments = [],
  services,
  skippedMessageIds = [],
}) => {
  const emails = await syncGmailMessages(gmailClientId, gmailAccessToken, null, {
    queries: GMAIL_SYNC_QUERIES,
    maxResults: 300,
  });
  const skippedVisitIds = new Set(skippedMessageIds);
  const existingDocumentIds = new Set(importDocuments.map((document) => document.id));
  const pendingEvents = [];
  const pendingDocuments = [];
  const parseErrors = [];
  let skippedAsProcessed = 0;
  let skippedAsDuplicate = 0;
  let unparsed = 0;

  emails.forEach((email) => {
    try {
      const document = parseImportDocument(email);
      if (document) {
        if (existingDocumentIds.has(document.id)) {
          skippedAsDuplicate += 1;
          return;
        }

        pendingDocuments.push(document);
        return;
      }

      if (skippedVisitIds.has(email.id)) {
        skippedAsProcessed += 1;
        return;
      }

      const extracted = parseBooksyGmailMessage(
        {
          subject: email.subject,
          body_text: email.text,
          from_address: email.from,
          reply_to: email.replyTo,
        },
        {employees, services},
      );

      if (!extracted) {
        unparsed += 1;
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
    pendingDocuments,
    parseErrors,
    scanned: emails.length,
    skippedAsProcessed,
    skippedAsDuplicate,
    unparsed,
  };
};

export const buildClientGmailConnection = ({
  gmailAccessToken,
  gmailClientId,
  googleEmail = "",
  lastSyncAt = null,
}) => ({
  is_connected: Boolean(gmailAccessToken),
  has_client_id: Boolean(gmailClientId?.trim()),
  google_email: googleEmail,
  last_sync_at: lastSyncAt,
  last_sync_error: null,
  mode: "client",
});
