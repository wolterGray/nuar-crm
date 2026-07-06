import {useCallback, useState} from "react";
import {
  buildJournalVisitEntry,
  resolvePaymentRowCalendarEntry,
} from "../utils/paymentJournal.js";
import {
  deleteCalendarEntry,
  deleteJournalFinancialVisit,
  deleteVisit,
  revertCompletedVisit,
} from "../api/visits.js";

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
  setClientPackages,
  setCertificates,
  setOpenPaymentActionMenuId,
  setVisits,
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

  const confirmPaymentDelete = useCallback(async () => {
    if (!pendingPaymentDelete) {
      return;
    }

    if (pendingPaymentDelete.calendarEntryId) {
      const completedVisit = visits.find(
        (item) => item.calendarEntryId === pendingPaymentDelete.calendarEntryId,
      ) ?? pendingPaymentDelete;
      const paymentName = String(completedVisit.payment ?? "").trim().toLowerCase();
      const usesPackage =
        Boolean(completedVisit.packageUsageId) ||
        Number(completedVisit.packageSessionsUsed) > 0 ||
        paymentName.includes("пакет") ||
        paymentName.includes("pakiet") ||
        paymentName.includes("package");
      const usesCertificate =
        Boolean(completedVisit.certificateUsageId) ||
        Number(completedVisit.certificateAmountUsed) > 0 ||
        paymentName.includes("сертификат") ||
        paymentName.includes("certyfikat") ||
        paymentName.includes("certificate");

      if (usesPackage || usesCertificate) {
        let response;

        try {
          response = await revertCompletedVisit({
            calendarEntryId: pendingPaymentDelete.calendarEntryId,
            visitId: pendingPaymentDelete.id,
          });
        } catch (error) {
          pushNotification({
            title: "Запись не удалена",
            message: error?.message || "Не удалось удалить визит в backend",
            persist: false,
          });
          return;
        }

        const restoredEntry = response?.data?.calendarEntry;
        const deletedVisitId = response?.data?.deletedVisitId ?? pendingPaymentDelete.id;
        const restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
          ? response.data.restoredClientPackages
          : [];
        const restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
          ? response.data.restoredCertificates
          : [];

        setVisits((current) =>
          current.filter((item) => item.id !== deletedVisitId),
        );
        if (restoredEntry) {
          setCalendarEntries((current) =>
            current.map((entry) => (entry.id === restoredEntry.id ? restoredEntry : entry)),
          );
        }
        if (restoredClientPackages.length > 0) {
          setClientPackages((current) =>
            current.map((item) =>
              restoredClientPackages.find((restoredPackage) => restoredPackage.id === item.id)
              ?? item,
            ),
          );
        }
        if (restoredCertificates.length > 0) {
          setCertificates((current) =>
            current.map((item) =>
              restoredCertificates.find((restoredCertificate) => restoredCertificate.id === item.id)
              ?? item,
            ),
          );
        }

        pushNotification({
          title: "Запись удалена",
          message: `${pendingPaymentDelete.client}: ${pendingPaymentDelete.service}`,
        });
        setPendingPaymentDelete(null);
        return;
      }

      try {
        await deleteVisit(pendingPaymentDelete.id);
        await deleteCalendarEntry(pendingPaymentDelete.calendarEntryId);
      } catch (error) {
        pushNotification({
          title: "Запись не удалена",
          message: error?.message || "Не удалось удалить визит в backend",
          persist: false,
        });
        return;
      }

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

      pushNotification({
        title: "Запись удалена",
        message: `${pendingPaymentDelete.client}: ${pendingPaymentDelete.service}`,
      });
      setPendingPaymentDelete(null);
      return;
    }

    const paymentName = String(pendingPaymentDelete.payment ?? "").trim().toLowerCase();
    const usesPackage =
      Boolean(pendingPaymentDelete.packageUsageId) ||
      Number(pendingPaymentDelete.packageSessionsUsed) > 0 ||
      paymentName.includes("пакет") ||
      paymentName.includes("pakiet") ||
      paymentName.includes("package");
    const usesCertificate =
      Boolean(pendingPaymentDelete.certificateUsageId) ||
      Number(pendingPaymentDelete.certificateAmountUsed) > 0 ||
      paymentName.includes("сертификат") ||
      paymentName.includes("certyfikat") ||
      paymentName.includes("certificate");

    if (usesPackage || usesCertificate) {
      let response;

      try {
        response = await deleteJournalFinancialVisit(pendingPaymentDelete.id);
      } catch (error) {
        pushNotification({
          title: "Запись не удалена",
          message: error?.message || "Не удалось удалить визит в backend",
          persist: false,
        });
        return;
      }

      const deletedVisitId = response?.data?.deletedVisitId ?? pendingPaymentDelete.id;
      const restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
        ? response.data.restoredClientPackages
        : [];
      const restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
        ? response.data.restoredCertificates
        : [];

      setVisits((current) => current.filter((item) => item.id !== deletedVisitId));
      if (restoredClientPackages.length > 0) {
        setClientPackages((current) =>
          current.map((item) =>
            restoredClientPackages.find((restoredPackage) => restoredPackage.id === item.id)
            ?? item,
          ),
        );
      }
      if (restoredCertificates.length > 0) {
        setCertificates((current) =>
          current.map((item) =>
            restoredCertificates.find((restoredCertificate) => restoredCertificate.id === item.id)
            ?? item,
          ),
        );
      }
    } else {
      try {
        await deleteVisit(pendingPaymentDelete.id);
      } catch (error) {
        pushNotification({
          title: "Запись не удалена",
          message: error?.message || "Не удалось удалить визит в backend",
          persist: false,
        });
        return;
      }

      setVisits((current) =>
        current.filter((item) => item.id !== pendingPaymentDelete.id),
      );
    }
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
    setCertificates,
    setClientPackages,
    setVisits,
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
