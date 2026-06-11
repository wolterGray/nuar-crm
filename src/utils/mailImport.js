export function processMailImports(
  items,
  {calendarEntries, clientProfiles, createLocalId, getCalendarServiceColor, importDocuments},
) {
  let nextClients = [...clientProfiles];
  let nextCalendarEntries = [...calendarEntries];
  let nextDocuments = [...importDocuments];
  const appliedIds = [];
  let addedClients = 0;
  let changedBookings = 0;

  const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
  const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

  items
    .sort((first, second) => first.receivedAt.localeCompare(second.receivedAt))
    .forEach((item) => {
      if (item.type === "document") {
        if (!nextDocuments.some((document) => document.id === item.id)) {
          nextDocuments = [item, ...nextDocuments];
        }
        appliedIds.push(item.id);
        return;
      }

      const importedClient = item.client;
      const booking = item.booking;
      const hasRequiredFields =
        importedClient.name &&
        booking.date &&
        booking.time &&
        booking.master &&
        booking.service;

      if (!hasRequiredFields) {
        return;
      }

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

      if (!client) {
        client = {
          id: createLocalId(),
          name: importedClient.name,
          phone: importedClient.phone,
          email: importedClient.email,
          birthday: "",
          instagram: "",
          telegram: "",
          source: "Booksy",
          preference: booking.master || "Любой мастер",
          status: "Новый",
          tags: "Booksy",
          note: "Добавлен автоматически из письма Booksy",
        };
        nextClients = [client, ...nextClients];
        addedClients += 1;
      } else if (client.source !== "Booksy") {
        nextClients = nextClients.map((candidate) =>
          candidate.id === client.id ? {...candidate, source: "Booksy"} : candidate,
        );
      }

      const previousDate = booking.previousDate || booking.date;
      const previousTime = booking.previousTime || booking.time;
      const existingEntry = nextCalendarEntries.find(
        (entry) =>
          entry.kind === "visit" &&
          normalizeText(entry.client) === normalizeText(client.name) &&
          ((entry.date === previousDate && entry.time === previousTime) ||
            (entry.date === booking.date && entry.time === booking.time)),
      );
      const entry = {
        ...(existingEntry ?? {}),
        id: existingEntry?.id ?? createLocalId(),
        kind: "visit",
        status: booking.status || existingEntry?.status || "scheduled",
        completedAt: existingEntry?.completedAt ?? "",
        visitId: existingEntry?.visitId ?? "",
        date: booking.date,
        time: booking.time,
        duration: booking.duration,
        master: booking.master,
        client: client.name,
        clientId: client.id,
        serviceId: booking.serviceId,
        service: booking.service,
        amount: booking.amount,
        payment: existingEntry?.payment || "Не указано",
        packageUsageId: existingEntry?.packageUsageId ?? "",
        packageName: existingEntry?.packageName ?? "",
        packageSessionsUsed: existingEntry?.packageSessionsUsed ?? 0,
        color: getCalendarServiceColor({
          kind: "visit",
          serviceId: booking.serviceId,
          service: booking.service,
          color: existingEntry?.color,
        }),
        note: existingEntry?.note || "Импортировано из Gmail · Booksy",
        externalSource: "Booksy",
        externalMessageId: item.id,
      };

      nextCalendarEntries = existingEntry
        ? nextCalendarEntries.map((currentEntry) =>
            currentEntry.id === entry.id ? entry : currentEntry,
          )
        : [...nextCalendarEntries, entry];
      changedBookings += 1;
      appliedIds.push(item.id);
    });

  return {
    addedClients,
    appliedIds,
    changedBookings,
    documentCount: items.filter((item) => item.type === "document").length,
    nextCalendarEntries,
    nextClients,
    nextDocuments,
  };
}
