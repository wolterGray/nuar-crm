const { withStoredId, cleanOptionalString } = require('./crudHelpers');

const objectPayload = (payload) =>
  payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

const dayCloseToFinanceNumber = (value) => {
  const normalized =
    typeof value === 'string' ? value.replace(/\s+/g, '').replace(',', '.') : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

const normalizeDayCloseText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replaceAll('ł', 'l')
    .replaceAll('ó', 'o')
    .replaceAll('ą', 'a')
    .replaceAll('ę', 'e')
    .replaceAll('ś', 's')
    .replaceAll('ć', 'c')
    .replaceAll('ń', 'n')
    .replaceAll('ż', 'z')
    .replaceAll('ź', 'z');

const normalizeDayClosePaymentMethod = (method) => {
  const value = normalizeDayCloseText(method);

  if (!value || value.includes('не указано') || value.includes('unknown')) {
    return 'unspecified';
  }
  if (value === 'mono' || value.includes('monobank') || (value.includes('mono') && !value.includes('monochrome'))) {
    return 'mono';
  }
  if (value.includes('ukr') || value.includes('укр')) {
    return 'ukrainianCard';
  }
  if (value.includes('gotowka') || value.includes('cash') || value.includes('нал') || value.includes('готів')) {
    return 'cash';
  }
  if (
    value.includes('terminal') ||
    value.includes('терминал') ||
    value.includes('термінал') ||
    value.includes('karta') ||
    value.includes('card') ||
    value.includes('карта')
  ) {
    return 'card';
  }
  if (value.includes('package') || value.includes('pakiet') || value.includes('пакет')) {
    return 'package';
  }
  if (
    value.includes('certificate') ||
    value.includes('certyfikat') ||
    value.includes('сертификат') ||
    value.includes('сертифікат')
  ) {
    return 'certificate';
  }
  if (value.includes('crypto') || value.includes('крипт')) {
    return 'crypto';
  }
  if (value.includes('blik')) {
    return 'blik';
  }
  if (value.includes('barter') || value.includes('бартер')) {
    return 'barter';
  }

  return 'unspecified';
};

const parseDayCloseDateParts = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      day: Number(isoMatch[3]),
      month: Number(isoMatch[2]),
      year: Number(isoMatch[1]),
    };
  }

  const appMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (appMatch) {
    return {
      day: Number(appMatch[1]),
      month: Number(appMatch[2]),
      year: Number(appMatch[3]),
    };
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      day: parsed.getDate(),
      month: parsed.getMonth() + 1,
      year: parsed.getFullYear(),
    };
  }

  return null;
};

const normalizeDayCloseDate = (value) => {
  const parts = parseDayCloseDateParts(value);
  if (!parts || !parts.year || !parts.month || !parts.day) {
    return String(value ?? '').trim();
  }

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

const getRecordPayload = (record) => objectPayload(record?.payload);

const formatDateForDayClose = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const getVisitPayloadForDayClose = (visit) => ({
  ...getRecordPayload(visit),
  id: visit?.id,
  date: getRecordPayload(visit).date ?? formatDateForDayClose(visit?.scheduledAt),
});

const getPackagePayloadForDayClose = (clientPackage) => ({
  ...getRecordPayload(clientPackage),
  id: clientPackage?.id,
  master: getRecordPayload(clientPackage).master ?? getRecordPayload(clientPackage).employeeName,
  totalVisits: clientPackage?.totalVisits ?? getRecordPayload(clientPackage).totalVisits,
  price: clientPackage?.price ?? getRecordPayload(clientPackage).price,
  purchaseDate: clientPackage?.purchaseDate ?? getRecordPayload(clientPackage).purchaseDate,
  payment: clientPackage?.payment ?? getRecordPayload(clientPackage).payment,
});

const isSameDayCloseDate = (value, date) => normalizeDayCloseDate(value) === date;

const isDayCloseCancelledVisit = (visit) =>
  ['cancelled', 'canceled', 'no_show'].includes(
    normalizeDayCloseText(visit?.status).replace('-', '_'),
  );

const isDayClosePackageVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'package';

const isDayCloseCertificateVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'certificate';

const isDayCloseBarterVisit = (visit) =>
  normalizeDayClosePaymentMethod(visit?.payment) === 'barter';

const hasExplicitDayClosePaidAmount = (visit) =>
  visit?.paidAmount !== undefined &&
  visit?.paidAmount !== null &&
  String(visit.paidAmount).trim() !== '';

const getDayCloseGrossAmount = (visit) => dayCloseToFinanceNumber(visit?.amount);
const getDayCloseTipAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.tip));
const getDayCloseExtraAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.extra));
const getDayCloseDebtAmount = (visit) => Math.max(0, dayCloseToFinanceNumber(visit?.debt));

const getDayCloseDiscountedAmount = (visit) => {
  if (hasExplicitDayClosePaidAmount(visit)) {
    return Math.max(0, dayCloseToFinanceNumber(visit.paidAmount));
  }

  const amount = getDayCloseGrossAmount(visit);
  const discount = dayCloseToFinanceNumber(visit?.discount);
  return Math.max(0, amount - amount * (discount / 100));
};

const getDayCloseServiceReceivedAmount = (visit) => {
  if (
    isDayCloseCancelledVisit(visit) ||
    isDayClosePackageVisit(visit) ||
    isDayCloseCertificateVisit(visit) ||
    isDayCloseBarterVisit(visit)
  ) {
    return 0;
  }

  if (hasExplicitDayClosePaidAmount(visit)) {
    return Math.max(0, dayCloseToFinanceNumber(visit.paidAmount));
  }

  return Math.max(0, getDayCloseDiscountedAmount(visit) - getDayCloseDebtAmount(visit));
};

const getDayCloseVisitReceivedAmount = (visit) => {
  if (isDayCloseCancelledVisit(visit)) {
    return 0;
  }

  if (visit?.recordType === 'operation') {
    return Math.max(0, getDayCloseExtraAmount(visit) || getDayCloseGrossAmount(visit));
  }

  return (
    getDayCloseServiceReceivedAmount(visit) +
    getDayCloseTipAmount(visit) +
    getDayCloseExtraAmount(visit)
  );
};

const getDayClosePlatformCommission = (visit) => {
  if (
    isDayCloseCancelledVisit(visit) ||
    isDayClosePackageVisit(visit) ||
    isDayCloseCertificateVisit(visit) ||
    isDayCloseBarterVisit(visit)
  ) {
    return 0;
  }

  if (visit?.commissionType === 'Booksy 45%') {
    const discountedAmount = getDayCloseDiscountedAmount(visit);
    const netAmount = Math.floor(discountedAmount - discountedAmount * 0.45 * 1.23);
    return Math.max(0, discountedAmount - Math.max(0, netAmount));
  }

  return Math.max(0, dayCloseToFinanceNumber(visit?.commission));
};

const getDayCloseEmployeeRate = (employees = [], employeeName = '') => {
  const employee = employees.find((item) => item.name === employeeName);
  return dayCloseToFinanceNumber(employee?.commissionRate);
};

const isPairDayCloseService = (serviceName = '') => {
  const normalized = String(serviceName).toLowerCase();
  return (
    normalized.includes('dwojga') ||
    normalized.includes('двоих') ||
    normalized.includes('парн') ||
    normalized.includes('pair') ||
    normalized.includes('dla 2') ||
    normalized.includes('для 2')
  );
};

const getDayCloseEmployeePayout = (visit, employees = []) => {
  if (isDayCloseCancelledVisit(visit) || isDayCloseBarterVisit(visit)) {
    return 0;
  }

  const serviceName = String(visit?.service ?? visit?.serviceName ?? '').toLowerCase();
  const isPair =
    Boolean(visit?.isParallel) ||
    Boolean(visit?.secondaryMaster) ||
    Number(visit?.parallelParticipants) > 1 ||
    isPairDayCloseService(serviceName);

  const participantCount = isPair ? Math.max(2, Number(visit?.parallelParticipants) || 2) : 1;

  const rate = getDayCloseEmployeeRate(employees, visit?.master);
  const fullBase =
    isDayClosePackageVisit(visit) || isDayCloseCertificateVisit(visit)
      ? getDayCloseDiscountedAmount(visit)
      : getDayCloseServiceReceivedAmount(visit);

  const base = fullBase / participantCount;

  return Math.round(Math.max(0, base) * (rate / 100));
};

const getDayClosePackageSaleEmployeePayout = (clientPackage, employees = []) => {
  const rate = getDayCloseEmployeeRate(employees, clientPackage?.master);
  return Math.round(Math.max(0, dayCloseToFinanceNumber(clientPackage?.price)) * (rate / 100));
};

const getDayClosePackageVisitEmployeePayout = (_visit = null, _employees = [], _clientPackages = []) => {
  return 0;
};

const isDayCloseCompletedVisit = (visit) => {
  if (isDayCloseCancelledVisit(visit)) {
    return false;
  }

  if (visit?.recordType === 'operation') {
    return true;
  }

  return visit?.status === 'completed' || visit?.isPlanned === false;
};

const isDayCloseExpenseOperation = (visit) =>
  visit?.recordType === 'operation' &&
  (normalizeDayCloseText(visit.service).includes('расход') ||
    normalizeDayCloseText(visit.service).includes('expense') ||
    dayCloseToFinanceNumber(visit.extra) < 0 ||
    dayCloseToFinanceNumber(visit.amount) < 0);

const buildServerDayCloseJournal = ({ clientPackages = [], employees = [], visits = [] }) => {
  const completedVisits = visits.filter(isDayCloseCompletedVisit);
  const completedAppointments = completedVisits.filter((visit) => visit.recordType !== 'operation');
  const financialOperations = completedVisits.filter((visit) => visit.recordType === 'operation');
  const incomeOperations = financialOperations.filter((visit) => !isDayCloseExpenseOperation(visit));
  const expenseOperations = financialOperations.filter(isDayCloseExpenseOperation);
  const paymentsByMethod = {
    cash: 0,
    card: 0,
    ukrainianCard: 0,
    mono: 0,
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
    const method = normalizeDayClosePaymentMethod(visit.payment);
    const received = getDayCloseVisitReceivedAmount(visit);
    paymentsByMethod[method] = (paymentsByMethod[method] ?? 0) + received;
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  for (const item of clientPackages) {
    const method = normalizeDayClosePaymentMethod(item.payment);
    paymentsByMethod[method] =
      (paymentsByMethod[method] ?? 0) + Math.max(0, dayCloseToFinanceNumber(item.price));
    paymentRecordsByMethod[method] = (paymentRecordsByMethod[method] ?? 0) + 1;
  }

  const serviceReceived = completedAppointments.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  const packageIncome = clientPackages.reduce(
    (sum, item) => sum + Math.max(0, dayCloseToFinanceNumber(item.price)),
    0,
  );
  const operationsIncome = incomeOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  const expenses = expenseOperations.reduce(
    (sum, visit) =>
      sum + Math.abs(dayCloseToFinanceNumber(visit.extra) || dayCloseToFinanceNumber(visit.amount)),
    0,
  );
  const platformCommission = completedAppointments.reduce(
    (sum, visit) => sum + getDayClosePlatformCommission(visit),
    0,
  );
  const packageSalePayouts = clientPackages.reduce(
    (sum, item) => sum + getDayClosePackageSaleEmployeePayout(item, employees),
    0,
  );
  const employeePayouts =
    completedAppointments.reduce(
      (sum, visit) =>
        sum +
        (isDayClosePackageVisit(visit)
          ? getDayClosePackageVisitEmployeePayout(visit, employees, clientPackages)
          : getDayCloseEmployeePayout(visit, employees)),
      0,
    ) + packageSalePayouts;
  const receivedRevenue = serviceReceived + packageIncome + operationsIncome;
  const netProfit = receivedRevenue - platformCommission - employeePayouts - expenses;

  return {
    booksyCommission: platformCommission,
    cashReceived: paymentsByMethod.cash,
    cardReceived: paymentsByMethod.card,
    completedVisits: completedAppointments.length,
    expenses,
    netProfit,
    operationsIncome,
    packageIncome,
    paymentRecordsByMethod,
    paymentsByMethod,
    receivedRevenue,
    tips: completedAppointments.reduce((sum, visit) => sum + getDayCloseTipAmount(visit), 0),
    ukrainianCardReceived: paymentsByMethod.ukrainianCard,
  };
};

const buildServerDayCloseRecordData = ({ actualCashInDrawer = 0, cashWithdrawal = 0, date, journal, note = '' }) => {
  const cash = dayCloseToFinanceNumber(journal?.cashReceived);
  const withdrawal = dayCloseToFinanceNumber(cashWithdrawal);
  const actual = dayCloseToFinanceNumber(actualCashInDrawer);
  const expectedCash = Math.max(0, cash - withdrawal);
  const variance = actual - expectedCash;
  const payload = {
    actual: {
      cashInDrawer: actual,
      cashWithdrawal: withdrawal,
    },
    closedAt: new Date().toISOString(),
    date,
    expectedCash,
    journal,
    note: String(note ?? '').trim(),
    status: 'closed',
    variance,
  };

  return {
    date,
    cash,
    card: dayCloseToFinanceNumber(journal?.paymentsByMethod?.card),
    blik: dayCloseToFinanceNumber(journal?.paymentsByMethod?.blik),
    certificates: dayCloseToFinanceNumber(journal?.paymentsByMethod?.certificate),
    packages: dayCloseToFinanceNumber(journal?.paymentsByMethod?.package),
    total: dayCloseToFinanceNumber(journal?.receivedRevenue),
    status: 'closed',
    note: String(note ?? '').trim(),
    payload,
  };
};

const buildPayrollPeriodKey = (startDate, endDate) =>
  `${normalizeDayCloseDate(startDate)}:${normalizeDayCloseDate(endDate)}`;

const isInPayrollPeriod = (value, startDate, endDate) => {
  const date = normalizeDayCloseDate(value);
  return Boolean(date && date >= startDate && date <= endDate);
};

const buildServerPayrollReport = ({
  clientPackages = [],
  employeeId = null,
  employees = [],
  endDate,
  startDate,
  visits = [],
}) => {
  const reportStartDate = normalizeDayCloseDate(startDate);
  const reportEndDate = normalizeDayCloseDate(endDate);
  const employeeIdNumber = employeeId ? Number(employeeId) : null;
  const filteredEmployees = employees
    .map(withStoredId)
    .filter((employee) => !employeeIdNumber || Number(employee.id) === employeeIdNumber);
  const employeeNames = new Set(filteredEmployees.map((employee) => employee.name));
  const completedVisits = visits
    .map(getVisitPayloadForDayClose)
    .filter(
      (visit) =>
        isDayCloseCompletedVisit(visit) &&
        !isDayCloseCancelledVisit(visit) &&
        visit.recordType !== 'operation' &&
        isInPayrollPeriod(visit.date, reportStartDate, reportEndDate) &&
        employeeNames.has(visit.master),
    );
  const financialOperations = visits
    .map(getVisitPayloadForDayClose)
    .filter(
      (visit) =>
        visit.recordType === 'operation' &&
        isInPayrollPeriod(visit.date, reportStartDate, reportEndDate) &&
        employeeNames.has(visit.master),
    );
  const certificateSaleOperations = financialOperations.filter((visit) => {
    const service = normalizeDayCloseText(visit.service);
    return (
      service.includes('сертификат') ||
      service.includes('сертифікат') ||
      service.includes('certyfikat') ||
      service.includes('certificate')
    );
  });
  const expenseOperations = financialOperations.filter(isDayCloseExpenseOperation);
  const incomeOperations = financialOperations.filter((visit) => !isDayCloseExpenseOperation(visit));
  const clientPackagePayloads = clientPackages.map(getPackagePayloadForDayClose);
  const packagesInPeriod = clientPackagePayloads.filter(
    (clientPackage) =>
      isInPayrollPeriod(clientPackage.purchaseDate, reportStartDate, reportEndDate) &&
      employeeNames.has(clientPackage.master),
  );
  const rows = filteredEmployees
    .map((employee) => {
      const employeeVisits = completedVisits.filter((visit) => visit.master === employee.name);
      const employeePackages = packagesInPeriod.filter((item) => item.master === employee.name);
      const employeeCertificateSales = certificateSaleOperations.filter(
        (visit) => visit.master === employee.name,
      );
      const employeeJournalOperations = financialOperations.filter(
        (visit) => visit.master === employee.name,
      );
      let servicePayout = 0;
      let packageVisitPayout = 0;
      let tips = 0;

      for (const visit of employeeVisits) {
        tips += getDayCloseTipAmount(visit);

        if (isDayClosePackageVisit(visit)) {
          packageVisitPayout += getDayClosePackageVisitEmployeePayout(
            visit,
            filteredEmployees,
            clientPackagePayloads,
          );
        } else {
          servicePayout += getDayCloseEmployeePayout(visit, filteredEmployees);
        }
      }

      const packageSalePayout = employeePackages.reduce(
        (sum, item) => sum + getDayClosePackageSaleEmployeePayout(item, filteredEmployees),
        0,
      );
      const totalPayout = servicePayout + packageVisitPayout + packageSalePayout;

      return {
        commissionRate: dayCloseToFinanceNumber(employee.commissionRate),
        employeeId: employee.id,
        employeeName: employee.name,
        certificateSalesAmount: employeeCertificateSales.reduce(
          (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
          0,
        ),
        certificateSalesCount: employeeCertificateSales.length,
        journalOperationsAmount: employeeJournalOperations.reduce(
          (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
          0,
        ),
        journalOperationsCount: employeeJournalOperations.length,
        packageSalePayout,
        packageSalesCount: employeePackages.length,
        packageVisitPayout,
        servicePayout,
        tips,
        totalPayout,
        visitsCount: employeeVisits.length,
      };
    })
    .filter(
      (row) =>
        row.totalPayout > 0 ||
        row.tips > 0 ||
        row.visitsCount > 0 ||
        row.packageSalesCount > 0,
    )
    .sort((left, right) => right.totalPayout - left.totalPayout);
  const totals = rows.reduce(
    (summary, row) => ({
      packageSalePayout: summary.packageSalePayout + row.packageSalePayout,
      packageVisitPayout: summary.packageVisitPayout + row.packageVisitPayout,
      certificateSalesAmount: summary.certificateSalesAmount + row.certificateSalesAmount,
      certificateSalesCount: summary.certificateSalesCount + row.certificateSalesCount,
      journalOperationsAmount: summary.journalOperationsAmount + row.journalOperationsAmount,
      journalOperationsCount: summary.journalOperationsCount + row.journalOperationsCount,
      servicePayout: summary.servicePayout + row.servicePayout,
      tips: summary.tips + row.tips,
      totalPayout: summary.totalPayout + row.totalPayout,
      visitsCount: summary.visitsCount + row.visitsCount,
    }),
    {
      packageSalePayout: 0,
      packageVisitPayout: 0,
      certificateSalesAmount: 0,
      certificateSalesCount: 0,
      journalOperationsAmount: 0,
      journalOperationsCount: 0,
      servicePayout: 0,
      tips: 0,
      totalPayout: 0,
      visitsCount: 0,
    },
  );
  totals.journalIncome = incomeOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  totals.journalExpenses = expenseOperations.reduce(
    (sum, visit) =>
      sum + Math.abs(dayCloseToFinanceNumber(visit.extra) || dayCloseToFinanceNumber(visit.amount)),
    0,
  );
  totals.certificateSalesAmount = certificateSaleOperations.reduce(
    (sum, visit) => sum + getDayCloseVisitReceivedAmount(visit),
    0,
  );
  totals.certificateSalesCount = certificateSaleOperations.length;

  return {
    employees: rows,
    endDate: reportEndDate,
    employeeId: employeeIdNumber || null,
    periodKey: buildPayrollPeriodKey(reportStartDate, reportEndDate),
    startDate: reportStartDate,
    totals,
  };
};

const buildServerPayrollRecordData = ({ employeeId = null, note = '', report }) => ({
  employeeId: employeeId ? Number(employeeId) : null,
  employeeName:
    report.employees.length === 1 ? cleanOptionalString(report.employees[0].employeeName) : null,
  startDate: report.startDate,
  endDate: report.endDate,
  periodKey: employeeId ? `${report.periodKey}:employee:${Number(employeeId)}` : report.periodKey,
  amount: dayCloseToFinanceNumber(report?.totals?.totalPayout),
  status: 'paid',
  paidAt: new Date(),
  note: cleanOptionalString(note),
  payload: {
    endDate: report.endDate,
    employeeId: employeeId ? Number(employeeId) : null,
    note: String(note ?? '').trim(),
    paidAt: new Date().toISOString(),
    periodKey: employeeId ? `${report.periodKey}:employee:${Number(employeeId)}` : report.periodKey,
    report,
    startDate: report.startDate,
    status: 'paid',
  },
});

module.exports = {
  objectPayload,
  dayCloseToFinanceNumber,
  normalizeDayCloseText,
  normalizeDayClosePaymentMethod,
  parseDayCloseDateParts,
  normalizeDayCloseDate,
  getRecordPayload,
  formatDateForDayClose,
  getVisitPayloadForDayClose,
  getPackagePayloadForDayClose,
  isSameDayCloseDate,
  isDayCloseCancelledVisit,
  isDayClosePackageVisit,
  isDayCloseCertificateVisit,
  isDayCloseBarterVisit,
  hasExplicitDayClosePaidAmount,
  getDayCloseGrossAmount,
  getDayCloseTipAmount,
  getDayCloseExtraAmount,
  getDayCloseDebtAmount,
  getDayCloseDiscountedAmount,
  getDayCloseServiceReceivedAmount,
  getDayCloseVisitReceivedAmount,
  getDayClosePlatformCommission,
  getDayCloseEmployeeRate,
  getDayCloseEmployeePayout,
  getDayClosePackageSaleEmployeePayout,
  getDayClosePackageVisitEmployeePayout,
  isDayCloseCompletedVisit,
  isDayCloseExpenseOperation,
  buildServerDayCloseJournal,
  buildServerDayCloseRecordData,
  buildPayrollPeriodKey,
  isInPayrollPeriod,
  buildServerPayrollReport,
  buildServerPayrollRecordData,
};
