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
    (entry) => {
      if (entry.kind !== "visit" || !entry.visitId) {
        return;
      }

      setVisits((current) =>
        current.map((visit) =>
          visit.id === entry.visitId || visit.calendarEntryId === entry.id
            ? attachClientLink(clientProfiles, {
                ...visit,
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
                note: entry.note || "",
              })
            : visit,
        ),
      );
    },
    [clientProfiles, setVisits],
  );

  const removeCompletedVisitLink = useCallback(
    (previousEntry, nextEntry) => {
      if (!shouldReopenCompletedCalendarEntry(nextEntry, previousEntry)) {
        return;
      }

      const completedVisit = visits.find(
        (visit) =>
          visit.id === previousEntry?.visitId ||
          visit.calendarEntryId === previousEntry?.id,
      );

      if (completedVisit) {
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
    [setVisits, updateCertificateBalance, updatePackageBalance, visits],
  );

  const saveCalendarEntry = useCallback(
    (entry, isEditing) => {
      const previousEntry = isEditing
        ? calendarEntries.find((item) => item.id === entry.id)
        : null;

      removeCompletedVisitLink(previousEntry, entry);
      setCalendarEntries((current) =>
        isEditing
          ? current.map((item) => (item.id === entry.id ? entry : item))
          : [...current, entry],
      );
      syncCompletedCalendarVisit(entry);
      setCalendarEntryModalOpen(false);
      setEditingCalendarEntry(null);
      setCalendarEntryDefaults({});
      pushNotification({
        title: isEditing ? "Календарь обновлен" : "Добавлено в календарь",
        message:
          entry.kind === "visit" ? `${entry.client} · ${entry.time}` : entry.title,
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
    (entry, {notify = true} = {}) => {
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
        note: entry.note || "",
      });

      const existingVisit = visits.find((item) => item.calendarEntryId === entry.id);
      const hasExistingVisit = Boolean(existingVisit);

      if (!hasExistingVisit) {
        setVisits((current) =>
          current.some((item) => item.calendarEntryId === entry.id)
            ? current
            : [visit, ...current],
        );
        updatePackageBalance(null, visit);
        updateCertificateBalance(null, visit);
      }

      setCalendarEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                status: "completed",
                completedAt: new Date().toISOString(),
                visitId: existingVisit?.id ?? visit.id,
              }
            : item,
        ),
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
    (eventOrForm) => {
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

        updatePackageBalance(previousVisit, nextVisit);
        updateCertificateBalance(previousVisit, nextVisit);
        setVisits((current) =>
          current.map((visit) =>
            visit.id === previousVisit.id ? nextVisit : visit,
          ),
        );
        setCalendarEntryModalOpen(false);
        setEditingJournalVisit(null);
        setEditingCalendarEntry(null);
        setCalendarEntryDefaults({});
        pushNotification({
          title: "Визит обновлен",
          message: `${nextVisit.client} · ${nextVisit.service}`,
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

      saveCalendarEntry(entry, isEditing);
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
    (entry) => {
      onCalendarSlotFreed?.(entry);
      setCalendarEntries((current) => current.filter((item) => item.id !== entry.id));
      pushNotification({
        title: entry.kind === "visit" ? "Запись отменена" : "Резерв удален",
        message: entry.kind === "visit" ? entry.client : entry.title,
      });
    },
    [onCalendarSlotFreed, pushNotification, setCalendarEntries],
  );

  const moveCalendarEntry = useCallback(
    (entryId, nextPosition) => {
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

      setCalendarEntries((current) =>
        current.map((entry) => (entry.id === entryId ? movedEntry : entry)),
      );
      removeCompletedVisitLink(currentEntry, movedEntry);
      syncCompletedCalendarVisit(movedEntry);
    },
    [
      appSettings,
      calendarEntries,
      employees,
      removeCompletedVisitLink,
      setCalendarEntries,
      syncCompletedCalendarVisit,
    ],
  );

  const confirmCalendarConflict = useCallback(() => {
    if (!pendingCalendarConflict) {
      return;
    }

    const {entry, isEditing, type} = pendingCalendarConflict;

    if (type === "move") {
      const previousEntry = calendarEntries.find((item) => item.id === entry.id);
      removeCompletedVisitLink(previousEntry, entry);
      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? entry : item)),
      );
      syncCompletedCalendarVisit(entry);
    } else {
      saveCalendarEntry(entry, isEditing);
    }

    setPendingCalendarConflict(null);
  }, [
    calendarEntries,
    pendingCalendarConflict,
    removeCompletedVisitLink,
    saveCalendarEntry,
    setCalendarEntries,
    syncCompletedCalendarVisit,
  ]);

  const updateCalendarEntryStatus = useCallback(
    (entry, status) => {
      if (status === "cancelled") {
        onCalendarSlotFreed?.(entry);
      }

      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? {...item, status} : item)),
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
