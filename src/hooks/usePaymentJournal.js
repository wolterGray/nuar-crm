import {useCallback, useState} from "react";
import {
  buildJournalVisitEntry,
  resolvePaymentRowCalendarEntry,
} from "../utils/paymentJournal.js";

export function usePaymentJournal({
  calendarEntries,
  clientProfiles,
  openEditCalendarEntry,
  pushNotification,
  serviceCatalog,
  setCalendarEntries,
  setCalendarEntryDefaults,
  setCalendarEntryModalOpen,
  setEditingCalendarEntry,
  setEditingFinancialOperation,
  setEditingJournalVisit,
  setFinancialOperationModalOpen,
  setOpenPaymentActionMenuId,
  setVisits,
  updateCertificateBalance,
  updatePackageBalance,
  visits,
}) {
  const [pendingPaymentDelete, setPendingPaymentDelete] = useState(null);

  const editPaymentRow = useCallback(
    (row) => {
      setOpenPaymentActionMenuId(null);

      if (row.recordType === "operation") {
        setEditingFinancialOperation(row);
        setFinancialOperationModalOpen(true);
        return;
      }

      const calendarEntry = resolvePaymentRowCalendarEntry(row, calendarEntries);

      if (calendarEntry) {
        setEditingJournalVisit(null);
        openEditCalendarEntry(calendarEntry);
        return;
      }

      const journalVisit = visits.find((visit) => visit.id === row.id);

      if (journalVisit) {
        setEditingJournalVisit(journalVisit);
        setEditingCalendarEntry(
          buildJournalVisitEntry(journalVisit, {clientProfiles, serviceCatalog}),
        );
        setCalendarEntryDefaults({});
        setCalendarEntryModalOpen(true);
      }
    },
    [
      calendarEntries,
      clientProfiles,
      openEditCalendarEntry,
      serviceCatalog,
      setCalendarEntryDefaults,
      setCalendarEntryModalOpen,
      setEditingCalendarEntry,
      setEditingFinancialOperation,
      setEditingJournalVisit,
      setFinancialOperationModalOpen,
      setOpenPaymentActionMenuId,
      visits,
    ],
  );

  const deletePaymentRow = useCallback(
    (visit) => {
      setPendingPaymentDelete(visit);
      setOpenPaymentActionMenuId(null);
    },
    [setOpenPaymentActionMenuId],
  );

  const cancelPaymentDelete = useCallback(() => {
    setPendingPaymentDelete(null);
  }, []);

  const confirmPaymentDelete = useCallback(() => {
    if (!pendingPaymentDelete) {
      return;
    }

    if (pendingPaymentDelete.calendarEntryId) {
      const completedVisit = visits.find(
        (item) => item.calendarEntryId === pendingPaymentDelete.calendarEntryId,
      );

      setCalendarEntries((current) =>
        current.filter((entry) => entry.id !== pendingPaymentDelete.calendarEntryId),
      );
      setVisits((current) =>
        current.filter(
          (item) =>
            item.id !== pendingPaymentDelete.id &&
            item.calendarEntryId !== pendingPaymentDelete.calendarEntryId,
        ),
      );

      if (completedVisit) {
        updatePackageBalance(completedVisit, null);
        updateCertificateBalance(completedVisit, null);
      }

      pushNotification({
        title: "Запись удалена",
        message: `${pendingPaymentDelete.client}: ${pendingPaymentDelete.service}`,
      });
      setPendingPaymentDelete(null);
      return;
    }

    updatePackageBalance(pendingPaymentDelete, null);
    updateCertificateBalance(pendingPaymentDelete, null);
    setVisits((current) =>
      current.filter((item) => item.id !== pendingPaymentDelete.id),
    );
    pushNotification({
      title:
        pendingPaymentDelete.recordType === "operation"
          ? "Поступление удалено"
          : "Запись удалена",
      message: `${
        pendingPaymentDelete.service || "Финансовая запись"
      } убрана из журнала`,
    });
    setPendingPaymentDelete(null);
  }, [
    pendingPaymentDelete,
    pushNotification,
    setCalendarEntries,
    setVisits,
    updateCertificateBalance,
    updatePackageBalance,
    visits,
  ]);

  return {
    cancelPaymentDelete,
    confirmPaymentDelete,
    deletePaymentRow,
    editPaymentRow,
    pendingPaymentDelete,
  };
}
