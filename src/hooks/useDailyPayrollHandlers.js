import {useCallback} from "react";
import {buildDailyPayrollDayReport} from "../utils/dailyPayroll.js";
import {formatMoney} from "../utils/formatters.jsx";

export function useDailyPayrollHandlers({
  clientPackages,
  employees,
  pushNotification,
  setVisits,
  visits,
}) {
  const getDailyPayrollReport = useCallback(
    ({date, employeeId}) => {
      const employee = employees.find(
        (item) => String(item.id) === String(employeeId),
      );

      return buildDailyPayrollDayReport({
        clientPackages,
        date,
        employee,
        employees,
        visits,
      });
    },
    [clientPackages, employees, visits],
  );

  const setVisitMasterPayoutPaid = useCallback(
    (visitId, paid) => {
      setVisits((current) =>
        current.map((visit) => {
          if (String(visit.id) !== String(visitId)) {
            return visit;
          }

          if (paid) {
            return {
              ...visit,
              masterPayoutPaidAt: new Date().toISOString(),
            };
          }

          const nextVisit = {...visit};
          delete nextVisit.masterPayoutPaidAt;
          return nextVisit;
        }),
      );
    },
    [setVisits],
  );

  const markAllDailyPayoutsPaid = useCallback(
    ({date, employeeId}) => {
      const report = getDailyPayrollReport({date, employeeId});

      if (!report) {
        return;
      }

      const unpaidIds = new Set(
        report.rows.filter((row) => !row.isPaid).map((row) => String(row.visitId)),
      );

      if (unpaidIds.size === 0) {
        return;
      }

      const paidAt = new Date().toISOString();
      setVisits((current) =>
        current.map((visit) =>
          unpaidIds.has(String(visit.id))
            ? {...visit, masterPayoutPaidAt: paidAt}
            : visit,
        ),
      );

      pushNotification({
        message: `${report.employeeName} · ${formatMoney(report.totals.unpaidPayout)}`,
        title: "Дневные выплаты отмечены",
      });
    },
    [getDailyPayrollReport, pushNotification, setVisits],
  );

  return {
    getDailyPayrollReport,
    markAllDailyPayoutsPaid,
    setVisitMasterPayoutPaid,
  };
}
