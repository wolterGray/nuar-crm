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

export function useDayCloseHandlers({
  calendarEntries,
  certificates,
  clientPackages,
  createLocalId,
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
    ({actualCashInDrawer, cashWithdrawal = 0, date, note = ""}) => {
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
        id: existing?.id ?? createLocalId(),
        journal,
        note,
      });

      setDayCloseRecords((current) =>
        sortDayCloseRecords([
          record,
          ...current.filter(
            (item) => normalizeCloseDate(item.date) !== normalizedDate,
          ),
        ]),
      );

      pushNotification({
        message: `${formatDayCloseLabel(normalizedDate)} · ${formatDayCloseVariance(record.variance)}`,
        title: existing ? "Закрытие дня обновлено" : "День закрыт",
      });
    },
    [
      createLocalId,
      dayCloseRecords,
      getJournalForDate,
      pushNotification,
      setDayCloseRecords,
    ],
  );

  const removeDayClose = useCallback(
    (record) => {
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
    (record) => {
      setDayCloseRecords((current) => current.filter((item) => item.id !== record.id));
    },
    [setDayCloseRecords],
  );

  return {
    closeDay,
    getJournalForDate,
    removeDayClose,
    reopenDayClose,
  };
}
