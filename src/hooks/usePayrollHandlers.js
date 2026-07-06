import {useCallback} from "react";
import {
  formatPayrollPeriodLabel,
  sortPayrollRecords,
} from "../utils/payroll.js";
import {
  deletePayrollRecord,
  fetchPayrollSummary,
  markPayrollPaidRecord,
} from "../api/financial.js";

export function usePayrollHandlers({
  payrollRecords,
  pushNotification,
  setPayrollRecords,
}) {
  const getPayrollReport = useCallback(
    async ({employeeId, endDate, startDate}) => {
      const response = await fetchPayrollSummary({employeeId, endDate, startDate});
      return response?.data ?? null;
    },
    [],
  );

  const markPayrollPaid = useCallback(
    async ({employeeId, endDate, note = "", startDate}) => {
      let savedRecord;

      try {
        const response = await markPayrollPaidRecord({
          employeeId,
          endDate,
          note,
          startDate,
        });
        savedRecord = response?.data;
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не принял payroll запись",
          persist: false,
          title: "Выплата не сохранена",
        });
        return;
      }

      if (!savedRecord) {
        pushNotification({
          message: "Backend не вернул payroll запись",
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
        message: `${formatPayrollPeriodLabel(startDate, endDate)} · ${savedRecord.report?.totals?.totalPayout ?? 0} zł`,
        title: payrollRecords.some((item) => item.periodKey === savedRecord.periodKey)
          ? "Выплата обновлена"
          : "Выплата отмечена",
      });
    },
    [
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
