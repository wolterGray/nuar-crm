import {attachClientLink} from "./clientLinks.js";
import {toInputDate} from "./formatters.jsx";

export const resolvePaymentRowCalendarEntry = (row, calendarEntries) => {
  const entryId =
    row.calendarEntryId ||
    (String(row.id).startsWith("calendar-")
      ? String(row.id).replace(/^calendar-/, "")
      : null);

  if (!entryId) {
    return null;
  }

  return calendarEntries.find((entry) => entry.id === entryId) ?? null;
};

export const buildJournalVisitEntry = (visit, {clientProfiles, serviceCatalog}) => {
  const service = serviceCatalog.find((item) => item.name === visit.service);

  return attachClientLink(clientProfiles, {
    kind: "visit",
    client: visit.client ?? "",
    clientId: visit.clientId ?? "",
    date: toInputDate(visit.date),
    time: visit.time || "10:00",
    duration: Number(visit.duration) || 60,
    master: visit.master ?? "",
    serviceId: service?.id ?? "",
    service: visit.service ?? "",
    amount: visit.amount ?? "",
    payment: visit.payment || "Наличные",
    packageUsageId: visit.packageUsageId ?? "",
    packageName: visit.packageName ?? "",
    packageSessionsUsed: visit.packageSessionsUsed ?? 0,
    commissionType: visit.commissionType || "Без комиссии",
    tip: visit.tip ?? "",
    extra: visit.extra ?? "",
    debt: visit.debt ?? "",
    discount: visit.discount ?? "",
    note: visit.note ?? "",
  });
};
