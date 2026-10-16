import {attachClientLink} from "./clientLinks.js";
import {getTodayInput} from "./dateHelpers.js";
import {toInputDate} from "./formatters.jsx";
import {
  getVisitCommission,
  getVisitDebt,
  getVisitTransactionTotal,
} from "./visits.jsx";

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

export const exportVisitsToCsv = (visits) => {
  const columns = [
    ["Дата", (visit) => visit.date],
    ["Клиент", (visit) => visit.client],
    ["Услуга", (visit) => visit.service],
    ["Работник", (visit) => visit.master],
    ["Стоимость", (visit) => visit.amount],
    ["Оплата", (visit) => visit.payment],
    ["Чай", (visit) => visit.tip],
    ["Комиссия", (visit) => getVisitCommission(visit)],
    ["Доп сумма", (visit) => visit.extra],
    ["Долг", (visit) => getVisitDebt(visit)],
    ["Скидка %", (visit) => visit.discount],
    ["Итог", (visit) => getVisitTransactionTotal(visit)],
    ["Комментарий", (visit) => visit.note],
  ];
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    columns.map(([label]) => escapeCell(label)).join(";"),
    ...visits.map((visit) =>
      columns.map(([, getValue]) => escapeCell(getValue(visit))).join(";"),
    ),
  ].join("\n");
  const link = document.createElement("a");

  link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], {type: "text/csv;charset=utf-8"}));
  link.download = `nuar-payments-${getTodayInput()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};
