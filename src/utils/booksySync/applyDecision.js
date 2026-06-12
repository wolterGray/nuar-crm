import {extractedEventToLegacyImportItem} from "./booksyGmailParser.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

export const applyBooksySyncDecision = (
  extractedEvent,
  {
    action,
    calendarEntries,
    clientProfiles,
    createLocalId,
    getCalendarServiceColor,
    linkedCalendarEntryId = null,
  },
) => {
  const legacyItem = extractedEventToLegacyImportItem(extractedEvent, {
    gmail_message_id: extractedEvent.gmail_message_id,
    subject: extractedEvent.subject,
    received_at: extractedEvent.received_at,
    extracted_event_id: extractedEvent.id,
    services: extractedEvent.services,
  });

  if (action === "ignore") {
    return {
      applied: false,
      nextCalendarEntries: calendarEntries,
      nextClients: clientProfiles,
      log: {action, result: "skipped"},
    };
  }

  const importedClient = legacyItem.client;
  const booking = legacyItem.booking;

  let nextClients = [...clientProfiles];
  let nextCalendarEntries = [...calendarEntries];

  let client = nextClients.find(
    (candidate) =>
      importedClient.email &&
      normalizeText(candidate.email) === normalizeText(importedClient.email),
  );
  client ??= nextClients.find(
    (candidate) =>
      importedClient.phone &&
      normalizePhone(candidate.phone) === normalizePhone(importedClient.phone),
  );
  client ??= nextClients.find(
    (candidate) => normalizeText(candidate.name) === normalizeText(importedClient.name),
  );

  if (!client && action !== "cancel" && action !== "link") {
    client = {
      id: createLocalId(),
      name: importedClient.name || "Клиент Booksy",
      phone: importedClient.phone,
      email: importedClient.email,
      birthday: "",
      instagram: "",
      telegram: "",
      source: "Booksy",
      preference: booking.master || "Любой мастер",
      status: "Новый",
      tags: "Booksy",
      note: "Добавлен из Booksy Gmail Sync",
    };
    nextClients = [client, ...nextClients];
  }

  const targetEntryId = linkedCalendarEntryId || extractedEvent.linked_calendar_entry_id;
  const existingEntry = targetEntryId
    ? nextCalendarEntries.find((entry) => entry.id === targetEntryId)
    : nextCalendarEntries.find(
        (entry) =>
          entry.kind === "visit" &&
          normalizeText(entry.client) === normalizeText(client?.name) &&
          entry.date === booking.date &&
          entry.time === booking.time,
      );

  if (action === "cancel") {
    if (!existingEntry) {
      return {
        applied: false,
        nextCalendarEntries,
        nextClients,
        log: {action, result: "error", details: {reason: "entry_not_found"}},
      };
    }

    nextCalendarEntries = nextCalendarEntries.map((entry) =>
      entry.id === existingEntry.id
        ? {...entry, status: "cancelled", note: "Отменено по письму Booksy"}
        : entry,
    );

    return {
      applied: true,
      nextCalendarEntries,
      nextClients,
      log: {action, result: "success", calendarEntryId: existingEntry.id},
    };
  }

  if (action === "link" && existingEntry) {
    return {
      applied: true,
      nextCalendarEntries,
      nextClients,
      log: {
        action,
        result: "success",
        calendarEntryId: existingEntry.id,
        linkedOnly: true,
      },
    };
  }

  const entry = {
    ...(existingEntry ?? {}),
    id: existingEntry?.id ?? createLocalId(),
    kind: "visit",
    status: booking.status || existingEntry?.status || "scheduled",
    completedAt: existingEntry?.completedAt ?? "",
    visitId: existingEntry?.visitId ?? "",
    date: booking.date || existingEntry?.date,
    time: booking.time || existingEntry?.time,
    duration: booking.duration || existingEntry?.duration || 60,
    master: booking.master || existingEntry?.master,
    client: client?.name || importedClient.name,
    clientId: client?.id ?? existingEntry?.clientId ?? "",
    serviceId: booking.serviceId || existingEntry?.serviceId || "",
    service: booking.service || existingEntry?.service,
    amount: booking.amount ?? existingEntry?.amount ?? 0,
    payment: existingEntry?.payment || "Не указано",
    packageUsageId: existingEntry?.packageUsageId ?? "",
    packageName: existingEntry?.packageName ?? "",
    packageSessionsUsed: existingEntry?.packageSessionsUsed ?? 0,
    color: getCalendarServiceColor({
      kind: "visit",
      serviceId: booking.serviceId || existingEntry?.serviceId,
      service: booking.service || existingEntry?.service,
      color: existingEntry?.color,
    }),
    note:
      booking.note ||
      existingEntry?.note ||
      "Импортировано из Booksy Gmail Sync",
    externalSource: "Booksy",
    externalMessageId: legacyItem.id,
  };

  nextCalendarEntries = existingEntry
    ? nextCalendarEntries.map((currentEntry) =>
        currentEntry.id === entry.id ? entry : currentEntry,
      )
    : [...nextCalendarEntries, entry];

  return {
    applied: true,
    nextCalendarEntries,
    nextClients,
    log: {
      action: action === "update" ? "update" : "create",
      result: "success",
      calendarEntryId: entry.id,
    },
  };
};
