import {formatAppDate, INPUT_DATE_FORMAT, isVisitInPeriod, parseAppDate} from "./dateUtils.js";
import {
  getPackageSaleEmployeePayout,
  getPackageVisitEmployeePayout,
  getVisitEmployeePayout,
  getVisitTipAmount,
  isCancelledVisit,
  isCompletedVisit,
  isPackageVisit,
  toFinanceNumber,
} from "./finance.js";
import {toDisplayDate} from "./formatters.jsx";

export const normalizePayrollDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : String(value ?? "").trim();
};

export const buildPayrollPeriodKey = (startDate, endDate) =>
  `${normalizePayrollDate(startDate)}:${normalizePayrollDate(endDate)}`;

export const buildPayrollReport = ({
  clientPackages = [],
  employees = [],
  endDate,
  now = new Date(),
  startDate,
  visits = [],
}) => {
  const normalizedStart = normalizePayrollDate(startDate);
  const normalizedEnd = normalizePayrollDate(endDate);
  const completedVisits = visits.filter(
    (visit) =>
      isCompletedVisit(visit, now) &&
      !isCancelledVisit(visit) &&
      visit.recordType !== "operation" &&
      isVisitInPeriod(visit, normalizedStart, normalizedEnd),
  );
  const packagesInPeriod = clientPackages.filter((item) =>
    isVisitInPeriod({date: item.purchaseDate}, normalizedStart, normalizedEnd),
  );
  const rows = employees
    .map((employee) => {
      const employeeVisits = completedVisits.filter(
        (visit) => visit.master === employee.name,
      );
      const employeePackages = packagesInPeriod.filter(
        (item) => item.master === employee.name,
      );
      let servicePayout = 0;
      let packageVisitPayout = 0;
      let tips = 0;

      for (const visit of employeeVisits) {
        tips += getVisitTipAmount(visit);

        if (isPackageVisit(visit)) {
          packageVisitPayout += getPackageVisitEmployeePayout(
            visit,
            employees,
            clientPackages,
          );
        } else {
          servicePayout += getVisitEmployeePayout(visit, employees);
        }
      }

      const packageSalePayout = employeePackages.reduce(
        (sum, item) => sum + getPackageSaleEmployeePayout(item, employees),
        0,
      );
      const totalPayout = servicePayout + packageVisitPayout + packageSalePayout;

      return {
        commissionRate: toFinanceNumber(employee.commissionRate),
        employeeId: employee.id,
        employeeName: employee.name,
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
      servicePayout: summary.servicePayout + row.servicePayout,
      tips: summary.tips + row.tips,
      totalPayout: summary.totalPayout + row.totalPayout,
      visitsCount: summary.visitsCount + row.visitsCount,
    }),
    {
      packageSalePayout: 0,
      packageVisitPayout: 0,
      servicePayout: 0,
      tips: 0,
      totalPayout: 0,
      visitsCount: 0,
    },
  );

  return {
    employees: rows,
    endDate: normalizedEnd,
    periodKey: buildPayrollPeriodKey(normalizedStart, normalizedEnd),
    startDate: normalizedStart,
    totals,
  };
};

export const buildPayrollRecord = ({
  endDate,
  id,
  note = "",
  paidAt = new Date().toISOString(),
  report,
  startDate,
}) => ({
  endDate: normalizePayrollDate(endDate),
  id,
  note: String(note ?? "").trim(),
  paidAt,
  periodKey: buildPayrollPeriodKey(startDate, endDate),
  report,
  startDate: normalizePayrollDate(startDate),
  status: "paid",
});

export const findPayrollRecord = (records = [], startDate, endDate) => {
  const periodKey = buildPayrollPeriodKey(startDate, endDate);

  return records.find((record) => record.periodKey === periodKey) ?? null;
};

export const sortPayrollRecords = (records = []) =>
  [...records].sort((left, right) =>
    String(right.paidAt ?? "").localeCompare(String(left.paidAt ?? "")),
  );

export const getRecentPayrollRecords = (records = [], limit = 12) =>
  sortPayrollRecords(records).slice(0, limit);

export const formatPayrollPeriodLabel = (startDate, endDate) =>
  `${toDisplayDate(startDate)} – ${toDisplayDate(endDate)}`;

export const getCurrentMonthPayrollRange = (value = new Date()) => {
  const parsed = parseAppDate(value) ?? value;

  return {
    endDate: formatAppDate(
      new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0),
      INPUT_DATE_FORMAT,
    ),
    startDate: formatAppDate(
      new Date(parsed.getFullYear(), parsed.getMonth(), 1),
      INPUT_DATE_FORMAT,
    ),
  };
};

export const getPreviousMonthPayrollRange = (value = new Date()) => {
  const parsed = parseAppDate(value) ?? value;
  const month = parsed.getMonth();
  const year = parsed.getFullYear();

  return {
    endDate: formatAppDate(new Date(year, month, 0), INPUT_DATE_FORMAT),
    startDate: formatAppDate(new Date(year, month - 1, 1), INPUT_DATE_FORMAT),
  };
};
