import {useCallback, useEffect, useState} from "react";
import {attachClientLink} from "../utils/clientLinks.js";
import {
  buildCalendarEntryFromForm,
  buildJournalVisitUpdateFromEntry,
} from "../utils/calendarEntryForm.js";
import {normalizeCalendarEntryTiming, shouldReopenCompletedCalendarEntry} from "../utils/calendarEntryTiming.js";
import {
  getCalendarConflicts,
  getCalendarShiftWarning,
} from "../utils/calendarConflicts.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";
import {
  computeCertificateRedemptionAmount,
} from "../utils/certificates.js";
import {getVisitDiscountedAmount} from "../utils/finance.js";
import {toVisitNumber} from "../utils/visits.jsx";
import {
  createCalendarEntry,
  createVisit,
  deleteCalendarEntry as deleteBackendCalendarEntry,
  deleteVisit,
  updateCalendarEntry,
  updateVisit,
} from "../api/visits.js";

export function useCalendarActions({
  appSettings,
  autoCompletedCalendarEntryIdsRef,
  calendarEntries,
  certificates,
  clientPackages,
  clientProfiles,
  createLocalId,
  editingCalendarEntry,
  editingJournalVisit,
  employees,
  getCalendarServiceColor,
  onCalendarSlotFreed,
  pushNotification,
  serviceCatalog,
  setActiveClientAlertId,
  setActivePage,
  setAutoCompletedCalendarEntryIds,
  setCalendarEntries,
  setCalendarEntryDefaults,
  setCalendarEntryModalOpen,
  setClientAlertsOpen,
  setEditingCalendarEntry,
  setEditingJournalVisit,
  setPreferredMessageClientId,
  setVisits,
  updateCertificateBalance,
  updatePackageBalance,
  visits,
}) {
  const [pendingCalendarAction, setPendingCalendarAction] = useState(null);
  const [pendingCalendarConflict, setPendingCalendarConflict] = useState(null);

  const openEditCalendarEntry = useCallback((entry) => {
    setEditingJournalVisit(null);
    setEditingCalendarEntry(entry);
    setCalendarEntryDefaults({});
    setCalendarEntryModalOpen(true);
  }, [
    setCalendarEntryDefaults,
    setCalendarEntryModalOpen,
    setEditingCalendarEntry,
    setEditingJournalVisit,
  ]);

  const openCreateCalendarEntry = useCallback((defaults = {}) => {
    setEditingCalendarEntry(null);
    setEditingJournalVisit(null);
    setCalendarEntryDefaults(defaults);
    setCalendarEntryModalOpen(true);
  }, [
    setCalendarEntryDefaults,
    setCalendarEntryModalOpen,
    setEditingCalendarEntry,
    setEditingJournalVisit,
  ]);

  const syncCompletedCalendarVisit = useCallback(
    async (entry) => {
      if (entry.kind !== "visit" || !entry.visitId) {
        return;
      }

      const previousVisit = visits.find(
        (visit) => visit.id === entry.visitId || visit.calendarEntryId === entry.id,
      );
      if (!previousVisit) {
        return;
      }

      const nextVisit = attachClientLink(clientProfiles, {
        ...previousVisit,
        date: toDisplayDate(entry.date),
        client: entry.client,
        clientId: entry.clientId,
        master: entry.master,
        service: entry.service,
        amount: toVisitNumber(entry.amount),
        payment: entry.payment || "Не указано",
        packageUsageId: entry.packageUsageId || "",
        packageName: entry.packageName || "",
        packageSessionsUsed: entry.packageSessionsUsed || 0,
        certificateUsageId: entry.certificateUsageId || "",
        certificateCode: entry.certificateCode || "",
        certificateAmountUsed: entry.certificateAmountUsed || 0,
        tip: toVisitNumber(entry.tip),
        commissionType: entry.commissionType || "Без комиссии",
        extra: toVisitNumber(entry.extra),
        debt: toVisitNumber(entry.debt),
        discount: toVisitNumber(entry.discount),
        paidAmount: entry.paidAmount ?? "",
        note: entry.note || "",
      });

      let savedVisit = nextVisit;
      try {
        const response = await updateVisit(previousVisit.id, nextVisit);
        savedVisit = response?.data ?? nextVisit;
      } catch (error) {
        pushNotification({
          title: "Визит не синхронизирован",
          message: error?.message || "Не удалось обновить визит в backend",
          persist: false,
        });
      }

      setVisits((current) =>
        current.map((visit) =>
          visit.id === entry.visitId || visit.calendarEntryId === entry.id
            ? savedVisit
            : visit,
        ),
      );
    },
    [clientProfiles, pushNotification, setVisits, visits],
  );

  const removeCompletedVisitLink = useCallback(
    async (previousEntry, nextEntry) => {
      if (!shouldReopenCompletedCalendarEntry(nextEntry, previousEntry)) {
        return;
      }

      const completedVisit = visits.find(
        (visit) =>
          visit.id === previousEntry?.visitId ||
          visit.calendarEntryId === previousEntry?.id,
      );

      if (completedVisit) {
        try {
          await deleteVisit(completedVisit.id);
        } catch (error) {
          pushNotification({
            title: "Визит не удален",
            message: error?.message || "Не удалось удалить завершенный визит",
            persist: false,
          });
          return;
        }
        updatePackageBalance(completedVisit, null);
        updateCertificateBalance(completedVisit, null);
        setVisits((current) =>
          current.filter(
            (visit) =>
              visit.id !== completedVisit.id &&
              visit.calendarEntryId !== previousEntry?.id,
          ),
        );
      }
    },
    [
      pushNotification,
      setVisits,
      updateCertificateBalance,
      updatePackageBalance,
      visits,
    ],
  );

  const saveCalendarEntry = useCallback(
    async (entry, isEditing) => {
      const previousEntry = isEditing
        ? calendarEntries.find((item) => item.id === entry.id)
        : null;
      let savedEntry = entry;

      await removeCompletedVisitLink(previousEntry, entry);

      try {
        const response = isEditing
          ? await updateCalendarEntry(entry.id, entry)
          : await createCalendarEntry(entry);
        savedEntry = response?.data ?? entry;
      } catch (error) {
        pushNotification({
          title: isEditing ? "Календарь не обновлен" : "Запись не добавлена",
          message: error?.message || "Не удалось сохранить запись в backend",
          persist: false,
        });
        return;
      }

      setCalendarEntries((current) =>
        isEditing
          ? current.map((item) => (item.id === savedEntry.id ? savedEntry : item))
          : [...current, savedEntry],
      );
      await syncCompletedCalendarVisit(savedEntry);
      setCalendarEntryModalOpen(false);
      setEditingCalendarEntry(null);
      setCalendarEntryDefaults({});
      pushNotification({
        title: isEditing ? "Календарь обновлен" : "Добавлено в календарь",
        message:
          savedEntry.kind === "visit"
            ? `${savedEntry.client} · ${savedEntry.time}`
            : savedEntry.title,
      });
    },
    [
      calendarEntries,
      pushNotification,
      removeCompletedVisitLink,
      setCalendarEntries,
      setCalendarEntryDefaults,
      setCalendarEntryModalOpen,
      setEditingCalendarEntry,
      syncCompletedCalendarVisit,
    ],
  );

  const completeCalendarVisit = useCallback(
    async (entry, {notify = true} = {}) => {
      if (["completed", "cancelled", "no_show"].includes(entry.status)) {
        return;
      }

      const matchedService = serviceCatalog.find(
        (service) => String(service.id) === String(entry.serviceId),
      );
      const matchedVariant = matchedService?.variants?.find(
        (variant) => Number(variant.duration) === Number(entry.duration),
      );
      const amount =
        entry.amount === "" || entry.amount === null || entry.amount === undefined
          ? toVisitNumber(matchedVariant?.price)
          : toVisitNumber(entry.amount);
      const certificate = certificates.find(
        (item) => String(item.id) === String(entry.certificateUsageId),
      );
      const certificateAmountUsed =
        entry.payment === "Сертификат"
          ? entry.certificateAmountUsed ||
            computeCertificateRedemptionAmount(
              certificate,
              getVisitDiscountedAmount({amount, discount: entry.discount}),
            )
          : 0;
      const visit = attachClientLink(clientProfiles, {
        id: createLocalId(),
        calendarEntryId: entry.id,
        date: toDisplayDate(entry.date),
        client: entry.client,
        clientId: entry.clientId,
        master: entry.master,
        service: entry.service,
        duration: "",
        amount,
        payment: entry.payment || "Не указано",
        packageUsageId: entry.packageUsageId || "",
        packageName: entry.packageName || "",
        packageSessionsUsed: entry.packageSessionsUsed || 0,
        certificateUsageId: entry.certificateUsageId || "",
        certificateCode: entry.certificateCode || certificate?.code || "",
        certificateAmountUsed,
        tip: toVisitNumber(entry.tip),
        commission: 0,
        commissionType: entry.commissionType || "Без комиссии",
        extra: toVisitNumber(entry.extra),
        debt: toVisitNumber(entry.debt),
        discount: toVisitNumber(entry.discount),
        paidAmount: entry.paidAmount ?? "",
        note: entry.note || "",
      });

      const existingVisit = visits.find((item) => item.calendarEntryId === entry.id);
      const hasExistingVisit = Boolean(existingVisit);
      let savedVisit = existingVisit ?? visit;

      if (!hasExistingVisit) {
        try {
          const response = await createVisit(visit);
          savedVisit = response?.data ?? visit;
        } catch (error) {
          pushNotification({
            title: "Визит не завершен",
            message: error?.message || "Не удалось сохранить визит в backend",
            persist: false,
          });
          return;
        }
        setVisits((current) =>
          current.some((item) => item.calendarEntryId === entry.id)
            ? current
            : [savedVisit, ...current],
        );
        updatePackageBalance(null, savedVisit);
        updateCertificateBalance(null, savedVisit);
      }

      const nextEntry = {
        ...entry,
        status: "completed",
        completedAt: new Date().toISOString(),
        visitId: savedVisit.id,
      };

      let savedEntry = nextEntry;
      try {
        const response = await updateCalendarEntry(entry.id, nextEntry);
        savedEntry = response?.data ?? nextEntry;
      } catch (error) {
        pushNotification({
          title: "Статус не сохранен",
          message: error?.message || "Не удалось обновить календарь в backend",
          persist: false,
        });
      }

      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? savedEntry : item)),
      );

      if (notify && !hasExistingVisit) {
        pushNotification({
          title: "Визит завершен",
          message: `${entry.client} добавлен в журнал визитов`,
        });
      }
    },
    [
      certificates,
      clientProfiles,
      createLocalId,
      pushNotification,
      serviceCatalog,
      setCalendarEntries,
      setVisits,
      updateCertificateBalance,
      updatePackageBalance,
      visits,
    ],
  );

  const handleCalendarEntrySubmit = useCallback(
    async (eventOrForm) => {
      eventOrForm.preventDefault?.();
      const formElement = eventOrForm.currentTarget ?? eventOrForm;
      const form = new FormData(formElement);
      const entry = buildCalendarEntryFromForm(form, {
        certificates,
        clientPackages,
        clientProfiles,
        createLocalId,
        editingCalendarEntry,
        getCalendarServiceColor,
        serviceCatalog,
      });

      if (editingJournalVisit) {
        const previousVisit = editingJournalVisit;
        const nextVisit = buildJournalVisitUpdateFromEntry(
          previousVisit,
          entry,
          clientProfiles,
        );

        let savedVisit = nextVisit;
        try {
          const response = await updateVisit(previousVisit.id, nextVisit);
          savedVisit = response?.data ?? nextVisit;
        } catch (error) {
          pushNotification({
            title: "Визит не обновлен",
            message: error?.message || "Не удалось обновить визит в backend",
            persist: false,
          });
          return;
        }

        updatePackageBalance(previousVisit, savedVisit);
        updateCertificateBalance(previousVisit, savedVisit);
        setVisits((current) =>
          current.map((visit) =>
            visit.id === previousVisit.id ? savedVisit : visit,
          ),
        );
        setCalendarEntryModalOpen(false);
        setEditingJournalVisit(null);
        setEditingCalendarEntry(null);
        setCalendarEntryDefaults({});
        pushNotification({
          title: "Визит обновлен",
          message: `${savedVisit.client} · ${savedVisit.service}`,
        });
        return;
      }

      const isEditing = Boolean(editingCalendarEntry);
      const conflicts = getCalendarConflicts(
        entry,
        calendarEntries,
        editingCalendarEntry?.id,
      );
      const shiftWarning = getCalendarShiftWarning(entry, {appSettings, employees});

      if (
        appSettings.calendarConflictWarnings &&
        (conflicts.length > 0 || shiftWarning)
      ) {
        setPendingCalendarConflict({
          entry,
          isEditing,
          conflicts,
          shiftWarning,
          type: "save",
        });
        return;
      }

      await saveCalendarEntry(entry, isEditing);
    },
    [
      appSettings,
      calendarEntries,
      certificates,
      clientPackages,
      clientProfiles,
      createLocalId,
      editingCalendarEntry,
      editingJournalVisit,
      employees,
      getCalendarServiceColor,
      pushNotification,
      saveCalendarEntry,
      serviceCatalog,
      setCalendarEntryDefaults,
      setCalendarEntryModalOpen,
      setEditingCalendarEntry,
      setEditingJournalVisit,
      setVisits,
      updateCertificateBalance,
      updatePackageBalance,
    ],
  );

  const deleteCalendarEntry = useCallback(
    async (entry) => {
      onCalendarSlotFreed?.(entry);
      const linkedVisit = visits.find(
        (visit) => visit.id === entry.visitId || visit.calendarEntryId === entry.id,
      );

      try {
        if (linkedVisit) {
          await deleteVisit(linkedVisit.id);
        }
        await deleteBackendCalendarEntry(entry.id);
      } catch (error) {
        pushNotification({
          title: "Запись не удалена",
          message: error?.message || "Не удалось удалить запись в backend",
          persist: false,
        });
        return;
      }

      setCalendarEntries((current) => current.filter((item) => item.id !== entry.id));
      if (linkedVisit) {
        setVisits((current) => current.filter((visit) => visit.id !== linkedVisit.id));
        updatePackageBalance(linkedVisit, null);
        updateCertificateBalance(linkedVisit, null);
      }
      pushNotification({
        title: entry.kind === "visit" ? "Запись отменена" : "Резерв удален",
        message: entry.kind === "visit" ? entry.client : entry.title,
      });
    },
    [
      onCalendarSlotFreed,
      pushNotification,
      setCalendarEntries,
      setVisits,
      updateCertificateBalance,
      updatePackageBalance,
      visits,
    ],
  );

  const moveCalendarEntry = useCallback(
    async (entryId, nextPosition) => {
      const currentEntry = calendarEntries.find((entry) => entry.id === entryId);
      const movedEntry = currentEntry
        ? normalizeCalendarEntryTiming({...currentEntry, ...nextPosition}, currentEntry)
        : null;
      const conflicts = movedEntry
        ? getCalendarConflicts(movedEntry, calendarEntries, entryId)
        : [];
      const shiftWarning = movedEntry
        ? getCalendarShiftWarning(movedEntry, {appSettings, employees})
        : "";

      if (!movedEntry) {
        return;
      }

      if (
        appSettings.calendarConflictWarnings &&
        (conflicts.length > 0 || shiftWarning)
      ) {
        setPendingCalendarConflict({
          entry: movedEntry,
          isEditing: true,
          conflicts,
          shiftWarning,
          type: "move",
        });
        return;
      }

      await removeCompletedVisitLink(currentEntry, movedEntry);

      let savedEntry = movedEntry;
      try {
        const response = await updateCalendarEntry(entryId, movedEntry);
        savedEntry = response?.data ?? movedEntry;
      } catch (error) {
        pushNotification({
          title: "Запись не перенесена",
          message: error?.message || "Не удалось обновить календарь в backend",
          persist: false,
        });
        return;
      }

      setCalendarEntries((current) =>
        current.map((entry) => (entry.id === entryId ? savedEntry : entry)),
      );
      await syncCompletedCalendarVisit(savedEntry);
    },
    [
      appSettings,
      calendarEntries,
      employees,
      pushNotification,
      removeCompletedVisitLink,
      setCalendarEntries,
      syncCompletedCalendarVisit,
    ],
  );

  const confirmCalendarConflict = useCallback(async () => {
    if (!pendingCalendarConflict) {
      return;
    }

    const {entry, isEditing, type} = pendingCalendarConflict;

    if (type === "move") {
      const previousEntry = calendarEntries.find((item) => item.id === entry.id);
      await removeCompletedVisitLink(previousEntry, entry);
      let savedEntry = entry;
      try {
        const response = await updateCalendarEntry(entry.id, entry);
        savedEntry = response?.data ?? entry;
      } catch (error) {
        pushNotification({
          title: "Запись не сохранена",
          message: error?.message || "Не удалось обновить календарь в backend",
          persist: false,
        });
        return;
      }
      setCalendarEntries((current) =>
        current.map((item) => (item.id === savedEntry.id ? savedEntry : item)),
      );
      await syncCompletedCalendarVisit(savedEntry);
    } else {
      await saveCalendarEntry(entry, isEditing);
    }

    setPendingCalendarConflict(null);
  }, [
    calendarEntries,
    pendingCalendarConflict,
    pushNotification,
    removeCompletedVisitLink,
    saveCalendarEntry,
    setCalendarEntries,
    syncCompletedCalendarVisit,
  ]);

  const updateCalendarEntryStatus = useCallback(
    async (entry, status) => {
      if (status === "cancelled") {
        onCalendarSlotFreed?.(entry);
      }

      const nextEntry = {...entry, status};
      let savedEntry = nextEntry;
      try {
        const response = await updateCalendarEntry(entry.id, nextEntry);
        savedEntry = response?.data ?? nextEntry;
      } catch (error) {
        pushNotification({
          title: "Статус не сохранен",
          message: error?.message || "Не удалось обновить календарь в backend",
          persist: false,
        });
        return;
      }

      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? savedEntry : item)),
      );
      pushNotification({
        title: "Статус визита обновлён",
        message: `${entry.client}: ${status === "cancelled" ? "отменён" : "обновлён"}`,
      });
    },
    [onCalendarSlotFreed, pushNotification, setCalendarEntries],
  );

  const remindCalendarClient = useCallback(
    (entry) => {
      const client = clientProfiles.find(
        (item) =>
          (entry.clientId && String(item.id) === String(entry.clientId)) ||
          item.name === entry.client,
      );

      if (!client) {
        return;
      }

      setPreferredMessageClientId(String(client.id));
      setActivePage("templates");
      setClientAlertsOpen(false);
      setActiveClientAlertId(null);
    },
    [
      clientProfiles,
      setActiveClientAlertId,
      setActivePage,
      setClientAlertsOpen,
      setPreferredMessageClientId,
    ],
  );

  const repeatClientVisit = useCallback(
    (client, appointment) => {
      const repeatedService = serviceCatalog.find(
        (service) =>
          String(service.id) === String(appointment.repeatDefaults.serviceId) ||
          service.name === appointment.repeatDefaults.service,
      );

      setActivePage("calendar");
      openCreateCalendarEntry({
        amount: appointment.repeatDefaults.amount,
        client: client.name,
        clientId: client.id,
        date: getTodayInput(),
        duration: appointment.repeatDefaults.duration,
        kind: "visit",
        master: appointment.repeatDefaults.master,
        payment: appointment.repeatDefaults.payment,
        serviceId: repeatedService?.id ?? "",
        time: "10:00",
      });
    },
    [openCreateCalendarEntry, serviceCatalog, setActivePage],
  );

  const requestCalendarAction = useCallback((type, entry) => {
    setPendingCalendarAction({type, entry});
  }, []);

  const confirmCalendarAction = useCallback(() => {
    if (!pendingCalendarAction) {
      return;
    }

    const {type, entry} = pendingCalendarAction;

    if (type === "edit") {
      openEditCalendarEntry(entry);
    } else if (type === "delete") {
      deleteCalendarEntry(entry);
    }

    setPendingCalendarAction(null);
  }, [deleteCalendarEntry, openEditCalendarEntry, pendingCalendarAction]);

  useEffect(() => {
    const now = new Date();
    const expiredEntries = calendarEntries.filter((entry) => {
      if (
        entry.kind !== "visit" ||
        entry.visitId ||
        ["completed", "cancelled", "no_show"].includes(entry.status) ||
        autoCompletedCalendarEntryIdsRef.current.has(entry.id)
      ) {
        return false;
      }

      const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
      end.setMinutes(end.getMinutes() + Number(entry.duration || 0));

      return end < now;
    });

    expiredEntries.forEach((entry) => {
      const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
      end.setMinutes(end.getMinutes() + Number(entry.duration || 0));
      const justCompleted = now.getTime() - end.getTime() <= 2 * 60 * 1000;

      autoCompletedCalendarEntryIdsRef.current.add(entry.id);
      completeCalendarVisit(entry, {notify: justCompleted});
    });

    if (expiredEntries.length > 0) {
      setAutoCompletedCalendarEntryIds((current) => [
        ...new Set([...current, ...expiredEntries.map((entry) => entry.id)]),
      ]);
    }
    // Reacts to calendar changes; entry id guard prevents repeated sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEntries]);

  return {
    cancelCalendarAction: () => setPendingCalendarAction(null),
    cancelCalendarConflict: () => setPendingCalendarConflict(null),
    confirmCalendarAction,
    confirmCalendarConflict,
    deleteCalendarEntry,
    handleCalendarEntrySubmit,
    moveCalendarEntry,
    onCalendarSlotFreed,
  openCreateCalendarEntry,
    openEditCalendarEntry,
    pendingCalendarAction,
    pendingCalendarConflict,
    remindCalendarClient,
    repeatClientVisit,
    requestCalendarAction,
    updateCalendarEntryStatus,
  };
}
