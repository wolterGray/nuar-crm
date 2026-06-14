import {
  formatAppDate,
  isFutureVisitDate,
  isVisitInPeriod,
  parseAppDate,
} from "./dateUtils.js";
import {safeCertificate, safePackage, safeVisit} from "./financeSchemas.js";

export const toFinanceNumber = (value) => {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : 0;
};

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("ł", "l")
    .replaceAll("ó", "o")
    .replaceAll("ą", "a")
    .replaceAll("ę", "e")
    .replaceAll("ś", "s")
    .replaceAll("ć", "c")
    .replaceAll("ń", "n")
    .replaceAll("ż", "z")
    .replaceAll("ź", "z");

export const normalizePaymentMethod = (method) => {
  const value = normalizeText(method);

  if (!value || value.includes("не указано") || value.includes("unknown")) {
    return "unspecified";
  }

  if (
    value === "mono" ||
    value.includes("monobank") ||
    (value.includes("mono") && !value.includes("monochrome"))
  ) {
    return "mono";
  }

  if (value.includes("ukr") || value.includes("укр")) {
    return "ukrainianCard";
  }

  if (
    value.includes("gotowka") ||
    value.includes("cash") ||
    value.includes("нал") ||
    value.includes("готів")
  ) {
    return "cash";
  }

  if (
    value.includes("terminal") ||
    value.includes("терминал") ||
    value.includes("термінал") ||
    value.includes("karta") ||
    value.includes("card") ||
    value.includes("карта")
  ) {
    return "card";
  }

  if (
    value.includes("package") ||
    value.includes("pakiet") ||
    value.includes("пакет")
  ) {
    return "package";
  }

  if (
    value.includes("certificate") ||
    value.includes("certyfikat") ||
    value.includes("сертификат") ||
    value.includes("сертифікат")
  ) {
    return "certificate";
  }

  if (value.includes("crypto") || value.includes("крипт")) {
    return "crypto";
  }

  if (value.includes("blik")) {
    return "blik";
  }

  if (value.includes("barter") || value.includes("бартер")) {
    return "barter";
  }

  return "unspecified";
};

export const isPackageVisit = (visit) =>
  normalizePaymentMethod(visit?.payment) === "package";

export const isCertificateVisit = (visit) =>
  normalizePaymentMethod(visit?.payment) === "certificate";

export const isBarterVisit = (visit) =>
  normalizePaymentMethod(visit?.payment) === "barter";

export const isCancelledVisit = (visit) =>
  ["cancelled", "canceled", "no_show"].includes(
    normalizeText(visit?.status).replace("-", "_"),
  );

export const getVisitGrossAmount = (visit) => toFinanceNumber(visit?.amount);

export const getVisitStandardDiscountedAmount = (visit) =>
  Math.max(
    0,
    getVisitGrossAmount(visit) -
      getVisitGrossAmount(visit) * (toFinanceNumber(visit?.discount) / 100),
  );

export const getVisitDiscountedAmount = (visit) => {
  if (hasExplicitPaidAmount(visit)) {
    return Math.max(0, toFinanceNumber(visit.paidAmount));
  }

  return getVisitStandardDiscountedAmount(visit);
};

export const getVisitDiscountAmount = (visit) =>
  Math.max(0, getVisitGrossAmount(visit) - getVisitDiscountedAmount(visit));

export const getVisitDebtAmount = (visit) =>
  Math.max(0, toFinanceNumber(visit?.debt));

export const getVisitTipAmount = (visit) =>
  Math.max(0, toFinanceNumber(visit?.tip));

export const getVisitExtraAmount = (visit) =>
  Math.max(0, toFinanceNumber(visit?.extra));

const hasExplicitPaidAmount = (visit) =>
  visit?.paidAmount !== undefined &&
  visit?.paidAmount !== null &&
  String(visit.paidAmount).trim() !== "";

export const getVisitServiceReceivedAmount = (visit) => {
  if (isCancelledVisit(visit) || isPackageVisit(visit) || isCertificateVisit(visit) || isBarterVisit(visit)) {
    return 0;
  }

  if (hasExplicitPaidAmount(visit)) {
    return Math.max(0, toFinanceNumber(visit.paidAmount));
  }

  return Math.max(0, getVisitDiscountedAmount(visit) - getVisitDebtAmount(visit));
};

export const getVisitReceivedAmount = (visit) => {
  if (isCancelledVisit(visit)) {
    return 0;
  }

  if (visit?.recordType === "operation") {
    return Math.max(0, getVisitExtraAmount(visit) || getVisitGrossAmount(visit));
  }

  return (
    getVisitServiceReceivedAmount(visit) +
    getVisitTipAmount(visit) +
    getVisitExtraAmount(visit)
  );
};

export const getVisitPlatformCommission = (visit) => {
  if (
    isCancelledVisit(visit) ||
    isPackageVisit(visit) ||
    isCertificateVisit(visit) ||
    isBarterVisit(visit)
  ) {
    return 0;
  }

  if (visit?.commissionType === "Booksy 45%") {
    const discountedAmount = getVisitDiscountedAmount(visit);
    const netAmount = Math.floor(
      discountedAmount - discountedAmount * 0.45 * 1.23,
    );

    return Math.max(0, discountedAmount - Math.max(0, netAmount));
  }

  return Math.max(0, toFinanceNumber(visit?.commission));
};

export const getVisitEmployeePayout = (visit, employees = []) => {
  if (isCancelledVisit(visit) || isBarterVisit(visit)) {
    return 0;
  }

  const employee = employees.find((item) => item.name === visit?.master);
  const rate = toFinanceNumber(employee?.commissionRate);
  const base =
    isPackageVisit(visit) || isCertificateVisit(visit)
      ? getVisitDiscountedAmount(visit)
      : getVisitServiceReceivedAmount(visit);

  return Math.round(Math.max(0, base) * (rate / 100));
};

const getEmployeeRate = (employees = [], employeeName = "") => {
  const employee = employees.find((item) => item.name === employeeName);

  return toFinanceNumber(employee?.commissionRate);
};

export const getPackageSaleEmployeePayout = (packageItem, employees = []) => {
  const rate = getEmployeeRate(employees, packageItem?.master);

  return Math.round(Math.max(0, toFinanceNumber(packageItem?.price)) * (rate / 100));
};

const getPackageVisitUnitAmount = (visit, clientPackages = []) => {
  const packageItem = clientPackages.find(
    (item) => String(item.id) === String(visit?.packageUsageId),
  );
  const totalVisits = Math.max(1, toFinanceNumber(packageItem?.totalVisits));
  const sessionsUsed = Math.max(1, toFinanceNumber(visit?.packageSessionsUsed) || 1);

  return (Math.max(0, toFinanceNumber(packageItem?.price)) / totalVisits) * sessionsUsed;
};

export const getPackageVisitEmployeePayout = (
  visit,
  employees = [],
  clientPackages = [],
) => {
  if (!isPackageVisit(visit)) {
    return 0;
  }

  const rate = getEmployeeRate(employees, visit?.master);

  return Math.round(getPackageVisitUnitAmount(visit, clientPackages) * (rate / 100));
};

export const getVisitNetProfit = (
  visit,
  employees = [],
  clientPackages = [],
) =>
  getVisitReceivedAmount(visit) -
  getVisitPlatformCommission(visit) -
  (isPackageVisit(visit)
    ? getPackageVisitEmployeePayout(visit, employees, clientPackages)
    : getVisitEmployeePayout(visit, employees));

export const parseFinanceDate = parseAppDate;

export const toFinanceInputDate = (date) => {
  return formatAppDate(date, "yyyy-MM-dd");
};

export const isFutureVisit = (visit, now = new Date()) => {
  return isFutureVisitDate(visit, now);
};

export const isCompletedVisit = (visit, now = new Date()) => {
  if (isCancelledVisit(visit)) {
    return false;
  }

  if (visit?.recordType === "operation") {
    return true;
  }

  if (visit?.status === "completed" || visit?.isPlanned === false) {
    return true;
  }

  return !isFutureVisit(visit, now);
};

const isExpenseOperation = (visit) =>
  visit?.recordType === "operation" &&
  (normalizeText(visit.service).includes("расход") ||
    normalizeText(visit.service).includes("expense") ||
    toFinanceNumber(visit.extra) < 0 ||
    toFinanceNumber(visit.amount) < 0);

const isCertificateSale = (visit) =>
  visit?.recordType === "operation" &&
  (normalizeText(visit.service).includes("сертификат") ||
    normalizeText(visit.service).includes("сертифікат") ||
    normalizeText(visit.service).includes("certyfikat") ||
    normalizeText(visit.service).includes("certificate"));

export const buildFinanceStats = ({
  visits = [],
  calendarEntries = [],
  certificates = [],
  clientPackages = [],
  employees = [],
  startDate,
  endDate,
  master = "",
  now = new Date(),
}) => {
  const safeVisits = visits.map(safeVisit);
  const safeCalendarEntries = calendarEntries.map(safeVisit);
  const safeClientPackages = clientPackages.map(safePackage);
  const safeCertificates = certificates.map(safeCertificate);
  const completedVisits = safeVisits.filter((visit) => {
    return (
      isCompletedVisit(visit, now) &&
      isVisitInPeriod(visit, startDate, endDate) &&
      (!master || visit.master === master)
    );
  });
  const completedAppointments = completedVisits.filter(
    (visit) => visit.recordType !== "operation",
  );
  const financialOperations = completedVisits.filter(
    (visit) => visit.recordType === "operation",
  );
  const incomeOperations = financialOperations.filter(
    (visit) => !isExpenseOperation(visit),
  );
  const expenseOperations = financialOperations.filter(isExpenseOperation);
  const filteredPackages = safeClientPackages.filter(
    (item) =>
      isVisitInPeriod({date: item.purchaseDate}, startDate, endDate) &&
      (!master || item.master === master),
  );
  const packageIncome = filteredPackages.reduce(
    (sum, item) => sum + Math.max(0, toFinanceNumber(item.price)),
    0,
  );
  const packageSalePayouts = filteredPackages.reduce(
    (sum, item) => sum + getPackageSaleEmployeePayout(item, employees),
    0,
  );
  const filteredCertificates = safeCertificates.filter(
    (item) =>
      isVisitInPeriod({date: item.purchaseDate}, startDate, endDate) &&
      (!master || item.master === master),
  );
  const linkedCertificateSaleVisitIds = new Set(
    safeCertificates.map((item) => item.saleVisitId).filter(Boolean),
  );
  const certificateIncomeFromCatalog = filteredCertificates.reduce(
    (sum, item) => sum + Math.max(0, toFinanceNumber(item.nominal)),
    0,
  );
  const certificateIncomeLegacy = incomeOperations
    .filter(isCertificateSale)
    .filter((visit) => !linkedCertificateSaleVisitIds.has(visit.id))
    .reduce((sum, visit) => sum + getVisitReceivedAmount(visit), 0);
  const certificateIncome =
    certificateIncomeFromCatalog + certificateIncomeLegacy;
  const operationsIncome = incomeOperations.reduce(
    (sum, visit) => sum + getVisitReceivedAmount(visit),
    0,
  );
  const expenses = expenseOperations.reduce(
    (sum, visit) =>
      sum + Math.abs(toFinanceNumber(visit.extra) || toFinanceNumber(visit.amount)),
    0,
  );
  const grossRevenue = completedAppointments.reduce(
    (sum, visit) =>
      isPackageVisit(visit) || isCertificateVisit(visit) || isBarterVisit(visit)
        ? sum
        : sum + getVisitGrossAmount(visit),
    0,
  );
  const discountedRevenue = completedAppointments.reduce(
    (sum, visit) =>
      isPackageVisit(visit) || isCertificateVisit(visit) || isBarterVisit(visit)
        ? sum
        : sum + getVisitDiscountedAmount(visit),
    0,
  );
  const serviceReceived = completedAppointments.reduce(
    (sum, visit) => sum + getVisitReceivedAmount(visit),
    0,
  );
  const receivedRevenue = serviceReceived + packageIncome + operationsIncome;
  const platformCommission = completedAppointments.reduce(
    (sum, visit) => sum + getVisitPlatformCommission(visit),
    0,
  );
  const employeePayouts = completedAppointments.reduce(
    (sum, visit) =>
      sum +
      (isPackageVisit(visit)
        ? getPackageVisitEmployeePayout(visit, employees, safeClientPackages)
        : getVisitEmployeePayout(visit, employees)),
    0,
  ) + packageSalePayouts;
  const debtVisits = safeVisits.filter((visit) => {
    return (
      !isCancelledVisit(visit) &&
      visit.recordType !== "operation" &&
      getVisitDebtAmount(visit) > 0 &&
      isVisitInPeriod(visit, startDate, endDate) &&
      (!master || visit.master === master)
    );
  });
  const allDebtVisits = safeVisits.filter(
    (visit) =>
      !isCancelledVisit(visit) &&
      visit.recordType !== "operation" &&
      getVisitDebtAmount(visit) > 0 &&
      (!master || visit.master === master),
  );
  const debtAmount = debtVisits.reduce(
    (sum, visit) => sum + getVisitDebtAmount(visit),
    0,
  );
  const outstandingDebts = allDebtVisits.reduce(
    (sum, visit) => sum + getVisitDebtAmount(visit),
    0,
  );
  const discounts = completedAppointments.reduce(
    (sum, visit) => sum + getVisitDiscountAmount(visit),
    0,
  );
  const tips = completedAppointments.reduce(
    (sum, visit) => sum + getVisitTipAmount(visit),
    0,
  );
  const extras = completedAppointments.reduce(
    (sum, visit) => sum + getVisitExtraAmount(visit),
    0,
  );
  const forecastVisits = safeCalendarEntries.filter((visit) => {
    return (
      visit.kind === "visit" &&
      !isCancelledVisit(visit) &&
      isFutureVisit(visit, now) &&
      isVisitInPeriod(visit, startDate, endDate) &&
      (!master || visit.master === master)
    );
  });
  const forecastRevenue = forecastVisits.reduce((sum, visit) => {
    if (isPackageVisit(visit) || isCertificateVisit(visit) || isBarterVisit(visit)) {
      return sum + getVisitTipAmount(visit) + getVisitExtraAmount(visit);
    }

    return sum + getVisitDiscountedAmount(visit) + getVisitTipAmount(visit) + getVisitExtraAmount(visit);
  }, 0);
  const paymentsByMethod = {
    cash: 0,
    card: 0,
    ukrainianCard: 0,
    package: 0,
    certificate: 0,
    crypto: 0,
    blik: 0,
    barter: 0,
    unspecified: 0,
  };
  const paymentRecordsByMethod = Object.fromEntries(
    Object.keys(paymentsByMethod).map((key) => [key, 0]),
  );

  for (const visit of [...completedAppointments, ...incomeOperations]) {
    const method = normalizePaymentMethod(visit.payment);
    const received = getVisitReceivedAmount(visit);
    paymentsByMethod[method] = (paymentsByMethod[method] ?? 0) + received;
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  for (const item of filteredPackages) {
    const method = normalizePaymentMethod(item.payment);
    paymentsByMethod[method] =
      (paymentsByMethod[method] ?? 0) + Math.max(0, toFinanceNumber(item.price));
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  const paidVisitAmounts = completedAppointments
    .filter(
      (visit) =>
        !isPackageVisit(visit) &&
        !isCertificateVisit(visit) &&
        !isBarterVisit(visit) &&
        getVisitServiceReceivedAmount(visit) > 0,
    )
    .map(getVisitServiceReceivedAmount);
  const receivedTransactions = [
    ...completedAppointments.map(getVisitReceivedAmount),
    ...incomeOperations.map(getVisitReceivedAmount),
    ...filteredPackages.map((item) => Math.max(0, toFinanceNumber(item.price))),
  ].filter((value) => value > 0);
  const averageVisitCheck =
    paidVisitAmounts.reduce((sum, value) => sum + value, 0) /
    Math.max(paidVisitAmounts.length, 1);
  const averageReceivedCheck =
    receivedTransactions.reduce((sum, value) => sum + value, 0) /
    Math.max(receivedTransactions.length, 1);
  const netProfit =
    receivedRevenue - platformCommission - employeePayouts - expenses;

  return {
    allDebtVisits,
    averageReceivedCheck,
    averageVisitCheck,
    cardReceived: paymentsByMethod.card,
    cashReceived: paymentsByMethod.cash,
    certificateIncome,
    completedAppointments,
    completedVisits,
    debtAmount,
    debtVisits,
    discountedRevenue,
    discounts,
    employeePayouts,
    expenses,
    extras,
    filteredPackages,
    financialOperations,
    forecastRevenue,
    forecastVisits,
    grossRevenue,
    netProfit,
    operationsIncome,
    outstandingDebts,
    packageIncome,
    packageSalePayouts,
    paymentRecordsByMethod,
    paymentsByMethod,
    platformCommission,
    receivedRevenue,
    serviceReceived,
    tips,
    ukrainianCardReceived: paymentsByMethod.ukrainianCard,
    unspecifiedReceived: paymentsByMethod.unspecified,
  };
};

const runAuditCase = (label, actual, expected) => ({
  actual,
  expected,
  metric: label,
  status: Object.is(actual, expected) ? "ok" : "fail",
});

export const auditFinanceLogic = () => {
  const employees = [{name: "Max", commissionRate: 40}];
  const baseVisit = {
    amount: 500,
    commission: 0,
    commissionType: "Без комиссии",
    date: "04.06.2026",
    discount: 0,
    extra: 0,
    master: "",
    payment: "Наличные",
    status: "completed",
    time: "12:00",
    tip: 0,
  };
  const cases = [
    runAuditCase("cash received", getVisitReceivedAmount(baseVisit), 500),
    runAuditCase(
      "20% discount received",
      getVisitReceivedAmount({...baseVisit, discount: 20}),
      400,
    ),
    runAuditCase(
      "full debt received",
      getVisitReceivedAmount({...baseVisit, debt: 500}),
      0,
    ),
    runAuditCase(
      "partial debt received",
      getVisitReceivedAmount({...baseVisit, debt: 200}),
      300,
    ),
    runAuditCase(
      "package visit service income",
      getVisitServiceReceivedAmount({...baseVisit, payment: "Пакет"}),
      0,
    ),
    runAuditCase(
      "certificate visit service income",
      getVisitServiceReceivedAmount({...baseVisit, payment: "Сертификат"}),
      0,
    ),
    runAuditCase(
      "cancelled received",
      getVisitReceivedAmount({...baseVisit, status: "cancelled"}),
      0,
    ),
    runAuditCase(
      "unspecified normalized",
      normalizePaymentMethod(""),
      "unspecified",
    ),
    runAuditCase(
      "booksy received unchanged",
      getVisitReceivedAmount({...baseVisit, commission: 50}),
      500,
    ),
    runAuditCase(
      "booksy manual net",
      getVisitNetProfit({...baseVisit, commission: 50}),
      450,
    ),
    runAuditCase(
      "employee payout",
      getVisitEmployeePayout({...baseVisit, master: "Max"}, employees),
      200,
    ),
    runAuditCase(
      "mono normalized",
      normalizePaymentMethod("monobank"),
      "mono",
    ),
    runAuditCase(
      "ukrainian card normalized",
      normalizePaymentMethod("Укр. карта"),
      "ukrainianCard",
    ),
    runAuditCase(
      "tips received",
      getVisitReceivedAmount({...baseVisit, tip: 50}),
      550,
    ),
    runAuditCase(
      "package tips received",
      getVisitReceivedAmount({...baseVisit, payment: "Пакет", tip: 50}),
      50,
    ),
  ];

  console.table(cases);
  return cases;
};

if (typeof window !== "undefined" && import.meta.env?.DEV) {
  window.auditFinanceLogic = auditFinanceLogic;
}
