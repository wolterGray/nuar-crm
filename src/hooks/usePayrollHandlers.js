import {useCallback} from "react";
import {
  buildPayrollRecord,
  buildPayrollReport,
  findPayrollRecord,
  formatPayrollPeriodLabel,
  sortPayrollRecords,
} from "../utils/payroll.js";
import {
  createPayrollRecord,
  deletePayrollRecord,
  updatePayrollRecord,
} from "../api/financial.js";

export function usePayrollHandlers({
  clientPackages,
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
    async ({endDate, note = "", startDate}) => {
      const report = getPayrollReport({endDate, startDate});
      const existing = findPayrollRecord(payrollRecords, startDate, endDate);
      const record = buildPayrollRecord({
        endDate,
        id: existing?.id,
        note,
        report,
        startDate,
      });
      let savedRecord;

      try {
        const response = existing
          ? await updatePayrollRecord(existing.id, record)
          : await createPayrollRecord(record);
        savedRecord = response?.data ?? record;
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не принял payroll запись",
          persist: false,
          title: "Выплата не сохранена",
        });
        return;
      }

      setPayrollRecords((current) =>
        sortPayrollRecords([
          savedRecord,
          ...current.filter((item) => item.periodKey !== savedRecord.periodKey),
        ]),
      );

      pushNotification({
        message: `${formatPayrollPeriodLabel(startDate, endDate)} · ${report.totals.totalPayout} zł`,
        title: existing ? "Выплата обновлена" : "Выплата отмечена",
      });
    },
    [
      getPayrollReport,
      payrollRecords,
      pushNotification,
      setPayrollRecords,
    ],
  );

  const removePayrollRecord = useCallback(
    async (record) => {
      try {
        await deletePayrollRecord(record.id);
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не удалил payroll запись",
          persist: false,
          title: "Запись о выплате не удалена",
        });
        return;
      }

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
    async (record) => {
      try {
        await deletePayrollRecord(record.id);
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не переоткрыл payroll период",
          persist: false,
          title: "Выплата не переоткрыта",
        });
        return;
      }

      setPayrollRecords((current) =>
        current.filter((item) => item.id !== record.id),
      );
    },
    [pushNotification, setPayrollRecords],
  );

  return {
    getPayrollReport,
    markPayrollPaid,
    removePayrollRecord,
    reopenPayrollRecord,
  };
}
