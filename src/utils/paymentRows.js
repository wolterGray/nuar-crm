import {toDisplayDate} from "./formatters.jsx";
import {isCalendarVisitPlanned} from "./calendarVisitStatus.js";
import {toVisitNumber} from "./visits.jsx";

export const buildPaymentRows = (calendarEntries, visits, now = new Date()) => {
  const calendarEntryById = new Map(
    calendarEntries
      .filter((entry) => entry.kind === "visit")
      .map((entry) => [entry.id, entry]),
  );
  const syncedCalendarEntryIds = new Set(
    visits.map((visit) => visit.calendarEntryId).filter(Boolean),
  );

  const normalizeCalendarEntryRow = (entry) => {
    const isPlanned = isCalendarVisitPlanned(entry, now);

    return {
      ...entry,
      id: `calendar-${entry.id}`,
      calendarEntryId: entry.id,
      date: toDisplayDate(entry.date),
      status: isPlanned ? entry.status : "completed",
      extra: toVisitNumber(entry.extra),
      tip: toVisitNumber(entry.tip),
      debt: toVisitNumber(entry.debt),
      commission: 0,
      commissionType: entry.commissionType || "Без комиссии",
      discount: toVisitNumber(entry.discount),
      isPlanned,
      paidAmount: entry.paidAmount ?? "",
    };
  };

  const syncedVisits = visits.map((visit) => {
    const entry = calendarEntryById.get(visit.calendarEntryId);
    const hasValue = (value) =>
      value !== undefined && value !== null && String(value).trim() !== "";

    if (!entry) {
      return visit;
    }

    return {
      ...visit,
      date: toDisplayDate(entry.date),
      client: entry.client || visit.client,
      master: entry.master || visit.master,
      service: entry.service || visit.service,
      amount: hasValue(entry.amount)
        ? toVisitNumber(entry.amount)
        : toVisitNumber(visit.amount),
      payment: entry.payment || visit.payment || "Не указано",
      packageUsageId: entry.packageUsageId || visit.packageUsageId || "",
      packageName: entry.packageName || visit.packageName || "",
      packageSessionsUsed:
        toVisitNumber(entry.packageSessionsUsed) ||
        toVisitNumber(visit.packageSessionsUsed),
      tip: hasValue(entry.tip) ? toVisitNumber(entry.tip) : toVisitNumber(visit.tip),
      extra: hasValue(entry.extra)
        ? toVisitNumber(entry.extra)
        : toVisitNumber(visit.extra),
      debt: hasValue(entry.debt) ? toVisitNumber(entry.debt) : toVisitNumber(visit.debt),
      commissionType: entry.commissionType || visit.commissionType || "Без комиссии",
      discount: hasValue(entry.discount)
        ? toVisitNumber(entry.discount)
        : toVisitNumber(visit.discount),
      paidAmount: hasValue(entry.paidAmount)
        ? entry.paidAmount
        : visit.paidAmount ?? "",
      note: entry.note || visit.note || "",
      status: entry.status === "completed" ? "completed" : visit.status,
    };
  });

  return [
    ...calendarEntries
      .filter(
        (entry) =>
          entry.kind === "visit" &&
          !entry.visitId &&
          !syncedCalendarEntryIds.has(entry.id),
      )
      .map(normalizeCalendarEntryRow),
    ...syncedVisits,
  ];
};

export const filterPaymentRows = (paymentRows, paymentFilters) =>
  paymentRows.filter(
    (visit) =>
      (!paymentFilters.master || visit.master === paymentFilters.master) &&
      (!paymentFilters.payment || visit.payment === paymentFilters.payment) &&
      (!paymentFilters.client || visit.client === paymentFilters.client) &&
      (!paymentFilters.date || visit.date === toDisplayDate(paymentFilters.date)),
  );
