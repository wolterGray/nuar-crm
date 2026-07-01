import {useCallback} from "react";
import {
  buildDayCloseJournal,
  buildDayCloseRecord,
  findDayCloseRecord,
  formatDayCloseLabel,
  formatDayCloseVariance,
  normalizeCloseDate,
  sortDayCloseRecords,
} from "../utils/dayClose.js";
import {
  createDayCloseRecord,
  deleteDayCloseRecord,
  updateDayCloseRecord,
} from "../api/financial.js";

export function useDayCloseHandlers({
  calendarEntries,
  certificates,
  clientPackages,
  dayCloseRecords,
  employees,
  pushNotification,
  setDayCloseRecords,
  visits,
}) {
  const getJournalForDate = useCallback(
    (date) =>
      buildDayCloseJournal({
        calendarEntries,
        certificates,
        clientPackages,
        date,
        employees,
        visits,
      }),
    [calendarEntries, certificates, clientPackages, employees, visits],
  );

  const closeDay = useCallback(
    async ({actualCashInDrawer, cashWithdrawal = 0, date, note = ""}) => {
      const normalizedDate = normalizeCloseDate(date);

      if (!normalizedDate) {
        return;
      }

      const journal = getJournalForDate(normalizedDate);
      const existing = findDayCloseRecord(dayCloseRecords, normalizedDate);
      const record = buildDayCloseRecord({
        actualCashInDrawer,
        cashWithdrawal,
        date: normalizedDate,
        id: existing?.id,
        journal,
        note,
      });
      let savedRecord;

      try {
        const response = existing
          ? await updateDayCloseRecord(existing.id, record)
          : await createDayCloseRecord(record);
        savedRecord = response?.data ?? record;
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не принял закрытие дня",
          persist: false,
          title: "Закрытие дня не сохранено",
        });
        return;
      }

      setDayCloseRecords((current) =>
        sortDayCloseRecords([
          savedRecord,
          ...current.filter(
            (item) => normalizeCloseDate(item.date) !== normalizedDate,
          ),
        ]),
      );

      pushNotification({
        message: `${formatDayCloseLabel(normalizedDate)} · ${formatDayCloseVariance(savedRecord.variance)}`,
        title: existing ? "Закрытие дня обновлено" : "День закрыт",
      });
    },
    [
      dayCloseRecords,
      getJournalForDate,
      pushNotification,
      setDayCloseRecords,
    ],
  );

  const removeDayClose = useCallback(
    async (record) => {
      try {
        await deleteDayCloseRecord(record.id);
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не удалил закрытие дня",
          persist: false,
          title: "Закрытие дня не удалено",
        });
        return;
      }

      setDayCloseRecords((current) =>
        current.filter((item) => item.id !== record.id),
      );
      pushNotification({
        message: formatDayCloseLabel(record.date),
        title: "Закрытие дня удалено",
      });
    },
    [pushNotification, setDayCloseRecords],
  );

  const reopenDayClose = useCallback(
    async (record) => {
      try {
        await deleteDayCloseRecord(record.id);
      } catch (error) {
        pushNotification({
          message: error?.message || "Backend не переоткрыл день",
          persist: false,
          title: "День не переоткрыт",
        });
        return;
      }

      setDayCloseRecords((current) => current.filter((item) => item.id !== record.id));
    },
    [pushNotification, setDayCloseRecords],
  );

  return {
    closeDay,
    getJournalForDate,
    removeDayClose,
    reopenDayClose,
  };
}
