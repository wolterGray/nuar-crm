import {useCallback} from "react";
import {
  buildPayrollRecord,
  buildPayrollReport,
  findPayrollRecord,
  formatPayrollPeriodLabel,
  sortPayrollRecords,
} from "../utils/payroll.js";

export function usePayrollHandlers({
  clientPackages,
  createLocalId,
  employees,
  payrollRecords,
  pushNotification,
  setPayrollRecords,
  visits,
}) {
  const getPayrollReport = useCallback(
    ({endDate, startDate}) =>
      buildPayrollReport({
        clientPackages,
        employees,
        endDate,
        startDate,
        visits,
      }),
    [clientPackages, employees, visits],
  );

  const markPayrollPaid = useCallback(
    ({endDate, note = "", startDate}) => {
      const report = getPayrollReport({endDate, startDate});
      const existing = findPayrollRecord(payrollRecords, startDate, endDate);
      const record = buildPayrollRecord({
        endDate,
        id: existing?.id ?? createLocalId(),
        note,
        report,
        startDate,
      });

      setPayrollRecords((current) =>
        sortPayrollRecords([
          record,
          ...current.filter((item) => item.periodKey !== record.periodKey),
        ]),
      );

      pushNotification({
        message: `${formatPayrollPeriodLabel(startDate, endDate)} · ${report.totals.totalPayout} zł`,
        title: existing ? "Выплата обновлена" : "Выплата отмечена",
      });
    },
    [
      createLocalId,
      getPayrollReport,
      payrollRecords,
      pushNotification,
      setPayrollRecords,
    ],
  );

  const removePayrollRecord = useCallback(
    (record) => {
      setPayrollRecords((current) =>
        current.filter((item) => item.id !== record.id),
      );
      pushNotification({
        message: formatPayrollPeriodLabel(record.startDate, record.endDate),
        title: "Запись о выплате удалена",
      });
    },
    [pushNotification, setPayrollRecords],
  );

  const reopenPayrollRecord = useCallback(
    (record) => {
      setPayrollRecords((current) =>
        current.filter((item) => item.id !== record.id),
      );
    },
    [setPayrollRecords],
  );

  return {
    getPayrollReport,
    markPayrollPaid,
    removePayrollRecord,
    reopenPayrollRecord,
  };
}
