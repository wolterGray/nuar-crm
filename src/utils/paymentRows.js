import {toDisplayDate} from "./formatters.jsx";
import {isCalendarVisitPlanned} from "./calendarVisitStatus.js";
import {toVisitNumber} from "./visits.jsx";

export const buildPaymentRows = (calendarEntries, visits, clientPackagesOrNow = [], suppliedNow = new Date()) => {
  const clientPackages = Array.isArray(clientPackagesOrNow) ? clientPackagesOrNow : [];
  const now = clientPackagesOrNow instanceof Date ? clientPackagesOrNow : suppliedNow;
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
      cashAmount: entry.cashAmount ?? "",
      cardAmount: entry.cardAmount ?? "",
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
      cashAmount: hasValue(entry.cashAmount)
        ? toVisitNumber(entry.cashAmount)
        : visit.cashAmount ?? "",
      cardAmount: hasValue(entry.cardAmount)
        ? toVisitNumber(entry.cardAmount)
        : visit.cardAmount ?? "",
      paidAmount: hasValue(entry.paidAmount)
        ? entry.paidAmount
        : visit.paidAmount ?? "",
      note: entry.note || visit.note || "",
      status: entry.status === "completed" ? "completed" : visit.status,
    };
  });

  const packageSales = clientPackages.map((packageItem) => {
    const client = typeof packageItem.client === "object"
      ? packageItem.client?.name
      : packageItem.client || packageItem.clientName;
    const amount = toVisitNumber(packageItem.price ?? packageItem.payload?.price);
    const payment = packageItem.payment || packageItem.payload?.payment || "Не указано";

    return {
      ...packageItem,
      id: `package-sale-${packageItem.id}`,
      sourceId: packageItem.id,
      recordType: "package_sale",
      readOnly: true,
      client: client || "Без имени",
      master: packageItem.master || packageItem.payload?.master || "—",
      service: `Продажа пакета: ${packageItem.packageName || packageItem.name || packageItem.payload?.packageName || "Пакет"}`,
      date: toDisplayDate(packageItem.purchaseDate || packageItem.payload?.purchaseDate),
      amount,
      paidAmount: amount,
      payment,
      cashAmount: payment === "Наличные" ? amount : packageItem.cashAmount ?? packageItem.payload?.cashAmount ?? "",
      cardAmount: payment === "Карта" ? amount : packageItem.cardAmount ?? packageItem.payload?.cardAmount ?? "",
      commission: 0,
      discount: 0,
      debt: 0,
      extra: 0,
      tip: 0,
      status: "completed",
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
    ...packageSales,
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
