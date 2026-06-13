import {isVisitInPeriod} from "./dateUtils.js";
import {
  getPackageVisitEmployeePayout,
  getVisitDiscountedAmount,
  getVisitEmployeePayout,
  getVisitServiceReceivedAmount,
  getVisitTipAmount,
  isCancelledVisit,
  isCompletedVisit,
  isPackageVisit,
  toFinanceNumber,
} from "./finance.js";
import {normalizePayrollDate} from "./payroll.js";

export const PAYROLL_SCHEDULE_DAILY = "daily";
export const PAYROLL_SCHEDULE_MONTHLY = "monthly";

export const normalizePayrollSchedule = (value) =>
  value === PAYROLL_SCHEDULE_DAILY
    ? PAYROLL_SCHEDULE_DAILY
    : PAYROLL_SCHEDULE_MONTHLY;

export const isDailyPayrollEmployee = (employee) =>
  normalizePayrollSchedule(employee?.payrollSchedule) === PAYROLL_SCHEDULE_DAILY;

export const isVisitMasterPayoutPaid = (visit) =>
  Boolean(String(visit?.masterPayoutPaidAt ?? "").trim());

export const getVisitMasterPayoutAmount = (
  visit,
  employees = [],
  clientPackages = [],
) => {
  if (isPackageVisit(visit)) {
    return getPackageVisitEmployeePayout(visit, employees, clientPackages);
  }

  return getVisitEmployeePayout(visit, employees);
};

export const buildDailyPayrollDayReport = ({
  clientPackages = [],
  date,
  employee,
  employees = [],
  now = new Date(),
  visits = [],
}) => {
  if (!employee) {
    return null;
  }

  const normalizedDate = normalizePayrollDate(date);
  const commissionRate = toFinanceNumber(employee.commissionRate);
  const employeeVisits = visits
    .filter(
      (visit) =>
        visit.master === employee.name &&
        isCompletedVisit(visit, now) &&
        !isCancelledVisit(visit) &&
        visit.recordType !== "operation" &&
        isVisitInPeriod(visit, normalizedDate, normalizedDate),
    )
    .sort((left, right) =>
      String(left.time ?? "").localeCompare(String(right.time ?? "")),
    );

  const rows = employeeVisits.map((visit) => {
    const payout = getVisitMasterPayoutAmount(visit, employees, clientPackages);
    const receivedAmount = isPackageVisit(visit)
      ? getVisitDiscountedAmount(visit)
      : getVisitServiceReceivedAmount(visit);

    return {
      client: visit.client ?? "",
      commissionRate,
      isPaid: isVisitMasterPayoutPaid(visit),
      paidAt: visit.masterPayoutPaidAt ?? "",
      payment: visit.payment ?? "",
      payout,
      receivedAmount,
      service: visit.service ?? "",
      time: visit.time ?? "",
      tip: getVisitTipAmount(visit),
      visitId: visit.id,
    };
  });

  const totals = rows.reduce(
    (summary, row) => ({
      paidCount: summary.paidCount + (row.isPaid ? 1 : 0),
      paidPayout: summary.paidPayout + (row.isPaid ? row.payout : 0),
      tips: summary.tips + row.tip,
      totalPayout: summary.totalPayout + row.payout,
      unpaidCount: summary.unpaidCount + (row.isPaid ? 0 : 1),
      unpaidPayout: summary.unpaidPayout + (row.isPaid ? 0 : row.payout),
      visitsCount: summary.visitsCount + 1,
    }),
    {
      paidCount: 0,
      paidPayout: 0,
      tips: 0,
      totalPayout: 0,
      unpaidCount: 0,
      unpaidPayout: 0,
      visitsCount: 0,
    },
  );

  return {
    commissionRate,
    date: normalizedDate,
    employeeId: employee.id,
    employeeName: employee.name,
    rows,
    totals,
  };
};

export const getDailyPayrollEmployees = (employees = []) =>
  employees.filter(isDailyPayrollEmployee);
