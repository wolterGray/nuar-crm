import {formatAppDate, INPUT_DATE_FORMAT, parseAppDate} from "./dateUtils.js";
import {buildFinanceStats, toFinanceNumber} from "./finance.js";
import {paymentGroups} from "./payments.js";
import {toDisplayDate} from "./formatters.jsx";

export const normalizeCloseDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : String(value ?? "").trim();
};

export const parseDayCloseAmount = (value) => toFinanceNumber(value);

export const buildDayCloseJournal = ({
  calendarEntries = [],
  certificates = [],
  clientPackages = [],
  date,
  employees = [],
  visits = [],
}) => {
  const stats = buildFinanceStats({
    calendarEntries,
    certificates,
    clientPackages,
    employees,
    endDate: date,
    startDate: date,
    visits,
  });

  return {
    cashReceived: stats.cashReceived,
    cardReceived: stats.cardReceived,
    ukrainianCardReceived: stats.ukrainianCardReceived,
    paymentsByMethod: {...stats.paymentsByMethod},
    paymentRecordsByMethod: {...stats.paymentRecordsByMethod},
    completedVisits: stats.completedAppointments.length,
    expenses: stats.expenses,
    netProfit: stats.netProfit,
    operationsIncome: stats.operationsIncome,
    receivedRevenue: stats.receivedRevenue,
    tips: stats.tips,
  };
};

export const buildDayCloseBreakdown = (journal = {}) =>
  paymentGroups
    .map((group) => ({
      ...group,
      count: journal.paymentRecordsByMethod?.[group.key] ?? 0,
      value: journal.paymentsByMethod?.[group.key] ?? 0,
    }))
    .filter((item) => item.value > 0 || item.count > 0);

export const calculateDayCloseVariance = ({
  actualCashInDrawer = 0,
  cashWithdrawal = 0,
  journalCash = 0,
}) => {
  const expectedCash = Math.max(0, toFinanceNumber(journalCash) - toFinanceNumber(cashWithdrawal));
  const actual = toFinanceNumber(actualCashInDrawer);
  const variance = actual - expectedCash;

  return {
    actual,
    expectedCash,
    variance,
  };
};

export const buildDayCloseRecord = ({
  actualCashInDrawer = 0,
  cashWithdrawal = 0,
  closedAt = new Date().toISOString(),
  date,
  id,
  journal,
  note = "",
}) => {
  const normalizedDate = normalizeCloseDate(date);
  const {actual, expectedCash, variance} = calculateDayCloseVariance({
    actualCashInDrawer,
    cashWithdrawal,
    journalCash: journal?.cashReceived ?? 0,
  });

  return {
    actual: {
      cashInDrawer: actual,
      cashWithdrawal: toFinanceNumber(cashWithdrawal),
    },
    closedAt,
    date: normalizedDate,
    expectedCash,
    id,
    journal,
    note: String(note ?? "").trim(),
    status: "closed",
    variance,
  };
};

export const findDayCloseRecord = (records = [], date) => {
  const normalizedDate = normalizeCloseDate(date);

  return (
    records.find((record) => normalizeCloseDate(record.date) === normalizedDate) ??
    null
  );
};

export const sortDayCloseRecords = (records = []) =>
  [...records].sort((left, right) =>
    normalizeCloseDate(right.date).localeCompare(normalizeCloseDate(left.date)),
  );

export const getRecentDayCloseRecords = (records = [], limit = 14) =>
  sortDayCloseRecords(records).slice(0, limit);

export const formatDayCloseLabel = (date) => toDisplayDate(date) || date || "—";

export const formatDayCloseVariance = (variance) => {
  const value = toFinanceNumber(variance);

  if (value === 0) {
    return "Сходится";
  }

  return value > 0 ? `Излишек ${value} zł` : `Недостача ${Math.abs(value)} zł`;
};
