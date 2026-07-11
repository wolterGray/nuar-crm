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
  completeVisit,
  createCalendarEntry,
  deleteCompletedCalendarEntry,
  deleteCalendarEntry as deleteBackendCalendarEntry,
  deleteVisit,
  revertCompletedVisit,
  updateCalendarEntry,
  updateCompletedVisit,
  updateJournalFinancialVisit,
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
  setClientPackages,
  setCertificates,
  setEditingCalendarEntry,
  setEditingJournalVisit,
  setPreferredMessageClientId,
  setVisits,
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
        (visit) =>
          String(visit.id) === String(entry.visitId) ||
          String(visit.calendarEntryId) === String(entry.id),
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
      let savedEntry = null;
      let savedClientPackage = null;
      let savedCertificate = null;
      let restoredClientPackages = [];
      let restoredCertificates = [];
      const canUseCompletedVisitEndpoint = entry.status === "completed";

      try {
        const response = canUseCompletedVisitEndpoint
          ? await updateCompletedVisit({
              calendarEntry: {
                ...entry,
                status: "completed",
                visitId: previousVisit.id,
              },
              calendarEntryId: entry.id,
              visit: nextVisit,
              visitId: previousVisit.id,
            })
          : await updateVisit(previousVisit.id, nextVisit);
        savedVisit = response?.data ?? nextVisit;
        if (canUseCompletedVisitEndpoint) {
          savedVisit = response?.data?.visit ?? nextVisit;
          savedEntry = response?.data?.calendarEntry ?? null;
          savedClientPackage = response?.data?.clientPackage ?? null;
          restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
            ? response.data.restoredClientPackages
            : [];
          savedCertificate = response?.data?.certificate ?? null;
          restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
            ? response.data.restoredCertificates
            : [];
        }
      } catch (error) {
        pushNotification({
          title: "Визит не синхронизирован",
          message: error?.message || "Не удалось обновить визит в backend",
          persist: false,
        });
        return;
      }

      setVisits((current) =>
        current.map((visit) =>
          String(visit.id) === String(previousVisit.id) ||
          String(visit.calendarEntryId) === String(entry.id)
            ? savedVisit
            : visit,
        ),
      );
      if (savedEntry) {
        setCalendarEntries((current) =>
          current.map((calendarEntry) =>
            String(calendarEntry.id) === String(savedEntry.id) ? savedEntry : calendarEntry,
          ),
        );
      }
      const clientPackagesToApply = [
        ...restoredClientPackages,
        ...(savedClientPackage ? [savedClientPackage] : []),
      ];
      if (clientPackagesToApply.length > 0) {
        setClientPackages((current) =>
          clientPackagesToApply.reduce(
            (nextPackages, packageItem) =>
              nextPackages.some((item) => item.id === packageItem.id)
                ? nextPackages.map((item) =>
                    item.id === packageItem.id ? packageItem : item,
                  )
                : [packageItem, ...nextPackages],
            current,
          ),
        );
      }
      const certificatesToApply = [
        ...restoredCertificates,
        ...(savedCertificate ? [savedCertificate] : []),
      ];
      if (certificatesToApply.length > 0) {
        setCertificates((current) =>
          certificatesToApply.reduce(
            (nextCertificates, certificateItem) =>
              nextCertificates.some((item) => item.id === certificateItem.id)
                ? nextCertificates.map((item) =>
                    item.id === certificateItem.id ? certificateItem : item,
                  )
                : [certificateItem, ...nextCertificates],
            current,
          ),
        );
      }
    },
    [
      clientProfiles,
      pushNotification,
      setCalendarEntries,
      setCertificates,
      setClientPackages,
      setVisits,
      visits,
    ],
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

        if (usesPackage) {
          let response;

          try {
            response = await revertCompletedVisit({
              calendarEntryId: previousEntry.id,
              visitId: completedVisit.id,
            });
          } catch (error) {
            pushNotification({
              title: "Визит не удален",
              message: error?.message || "Не удалось откатить пакетный визит",
              persist: false,
            });
            return;
          }

          const restoredEntry = response?.data?.calendarEntry;
          const deletedVisitId = response?.data?.deletedVisitId ?? completedVisit.id;
          const restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
            ? response.data.restoredClientPackages
            : [];
          const restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
            ? response.data.restoredCertificates
            : [];

          setVisits((current) =>
            current.filter(
              (visit) =>
                visit.id !== deletedVisitId &&
                visit.id !== completedVisit.id &&
                visit.calendarEntryId !== previousEntry?.id,
            ),
          );
          if (restoredEntry) {
            setCalendarEntries((current) =>
              current.map((entry) => (entry.id === restoredEntry.id ? restoredEntry : entry)),
            );
          }
          if (restoredClientPackages.length > 0) {
            setClientPackages((current) =>
              restoredClientPackages.reduce(
                (nextPackages, restoredPackage) =>
                  nextPackages.some((item) => item.id === restoredPackage.id)
                    ? nextPackages.map((item) =>
                        item.id === restoredPackage.id ? restoredPackage : item,
                      )
                    : [restoredPackage, ...nextPackages],
                current,
              ),
            );
          }
          if (restoredCertificates.length > 0) {
            setCertificates((current) =>
              restoredCertificates.reduce(
                (nextCertificates, restoredCertificate) =>
                  nextCertificates.some((item) => item.id === restoredCertificate.id)
                    ? nextCertificates.map((item) =>
                        item.id === restoredCertificate.id ? restoredCertificate : item,
                      )
                    : [restoredCertificate, ...nextCertificates],
                current,
              ),
            );
          }
          return;
        }

        if (usesCertificate && !usesPackage) {
          let response;

          try {
            response = await revertCompletedVisit({
              calendarEntryId: previousEntry.id,
              visitId: completedVisit.id,
            });
          } catch (error) {
            pushNotification({
              title: "Визит не удален",
              message: error?.message || "Не удалось откатить сертификатный визит",
              persist: false,
            });
            return;
          }

          const restoredEntry = response?.data?.calendarEntry;
          const deletedVisitId = response?.data?.deletedVisitId ?? completedVisit.id;
          const restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
            ? response.data.restoredCertificates
            : [];

          setVisits((current) =>
            current.filter(
              (visit) =>
                visit.id !== deletedVisitId &&
                visit.id !== completedVisit.id &&
                visit.calendarEntryId !== previousEntry?.id,
            ),
          );
          if (restoredEntry) {
            setCalendarEntries((current) =>
              current.map((entry) => (entry.id === restoredEntry.id ? restoredEntry : entry)),
            );
          }
          if (restoredCertificates.length > 0) {
            setCertificates((current) =>
              restoredCertificates.reduce(
                (nextCertificates, restoredCertificate) =>
                  nextCertificates.some((item) => item.id === restoredCertificate.id)
                    ? nextCertificates.map((item) =>
                        item.id === restoredCertificate.id ? restoredCertificate : item,
                      )
                    : [restoredCertificate, ...nextCertificates],
                current,
              ),
            );
          }
          return;
        }

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
      setCalendarEntries,
      setCertificates,
      setClientPackages,
      setVisits,
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

      {
        const completedAt = new Date().toISOString();
        let savedEntry = {
          ...entry,
          completedAt,
          status: "completed",
          visitId: savedVisit.id,
        };
        let completeResponse;

        try {
          completeResponse = await completeVisit({
            calendarEntryId: entry.id,
            completedAt,
            visit,
          });
          savedVisit = completeResponse?.data?.visit ?? savedVisit;
          savedEntry = completeResponse?.data?.calendarEntry ?? {
            ...savedEntry,
            visitId: savedVisit.id,
          };
        } catch (error) {
          pushNotification({
            title: "Визит не завершен",
            message: error?.message || "Не удалось завершить визит в backend",
            persist: false,
          });
          return;
        }

        const savedClientPackage = completeResponse?.data?.clientPackage;
        const savedCertificate = completeResponse?.data?.certificate;

        setVisits((current) =>
          current.some((item) => item.calendarEntryId === entry.id)
            ? current.map((item) =>
                item.calendarEntryId === entry.id || item.id === savedVisit.id
                  ? savedVisit
                  : item,
              )
            : [savedVisit, ...current],
        );
        setCalendarEntries((current) =>
          current.map((item) => (item.id === entry.id ? savedEntry : item)),
        );
        if (savedClientPackage) {
          setClientPackages((current) =>
            current.some((item) => item.id === savedClientPackage.id)
              ? current.map((item) =>
                  item.id === savedClientPackage.id ? savedClientPackage : item,
                )
              : [savedClientPackage, ...current],
          );
        }
        if (savedCertificate) {
          setCertificates((current) =>
            current.some((item) => item.id === savedCertificate.id)
              ? current.map((item) =>
                  item.id === savedCertificate.id ? savedCertificate : item,
                )
              : [savedCertificate, ...current],
          );
        }

        if (notify && !hasExistingVisit) {
          pushNotification({
            title: "Визит завершен",
            message: `${entry.client} добавлен в журнал визитов`,
          });
        }

        return;
      }
    },
    [
      certificates,
      clientProfiles,
      createLocalId,
      pushNotification,
      serviceCatalog,
      setCalendarEntries,
      setClientPackages,
      setCertificates,
      setVisits,
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
        const linkedEntry = calendarEntries.find(
          (calendarEntry) =>
            String(calendarEntry.id) === String(previousVisit.calendarEntryId) ||
            String(calendarEntry.visitId) === String(previousVisit.id),
        );
        const canUseCompletedVisitEndpoint =
          Boolean(previousVisit.calendarEntryId) &&
          linkedEntry?.status === "completed";
        const previousPaymentName = String(previousVisit.payment ?? "").trim().toLowerCase();
        const nextPaymentName = String(nextVisit.payment ?? "").trim().toLowerCase();
        const previousUsesFinancialLedger =
          Boolean(previousVisit.packageUsageId) ||
          Boolean(previousVisit.certificateUsageId) ||
          Number(previousVisit.packageSessionsUsed) > 0 ||
          Number(previousVisit.certificateAmountUsed) > 0 ||
          previousPaymentName.includes("пакет") ||
          previousPaymentName.includes("pakiet") ||
          previousPaymentName.includes("package") ||
          previousPaymentName.includes("сертификат") ||
          previousPaymentName.includes("certyfikat") ||
          previousPaymentName.includes("certificate");
        const nextUsesFinancialLedger =
          Boolean(nextVisit.packageUsageId) ||
          Boolean(nextVisit.certificateUsageId) ||
          Number(nextVisit.packageSessionsUsed) > 0 ||
          Number(nextVisit.certificateAmountUsed) > 0 ||
          nextPaymentName.includes("пакет") ||
          nextPaymentName.includes("pakiet") ||
          nextPaymentName.includes("package") ||
          nextPaymentName.includes("сертификат") ||
          nextPaymentName.includes("certyfikat") ||
          nextPaymentName.includes("certificate");
        const canUseJournalFinancialEndpoint =
          !canUseCompletedVisitEndpoint &&
          !previousVisit.calendarEntryId &&
          (previousUsesFinancialLedger || nextUsesFinancialLedger);

        let savedVisit = nextVisit;
        let savedEntry = null;
        let savedClientPackage = null;
        let savedCertificate = null;
        let restoredClientPackages = [];
        let restoredCertificates = [];
        try {
          const response = canUseCompletedVisitEndpoint
            ? await updateCompletedVisit({
                calendarEntry: {
                  ...linkedEntry,
                  ...entry,
                  status: "completed",
                  visitId: previousVisit.id,
                },
                calendarEntryId: previousVisit.calendarEntryId,
                visit: nextVisit,
                visitId: previousVisit.id,
              })
            : canUseJournalFinancialEndpoint
              ? await updateJournalFinancialVisit(previousVisit.id, nextVisit)
              : await updateVisit(previousVisit.id, nextVisit);
          savedVisit = response?.data ?? nextVisit;
          if (canUseCompletedVisitEndpoint || canUseJournalFinancialEndpoint) {
            savedVisit = response?.data?.visit ?? nextVisit;
            savedEntry = response?.data?.calendarEntry ?? null;
            savedClientPackage = response?.data?.clientPackage ?? null;
            restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
              ? response.data.restoredClientPackages
              : [];
            savedCertificate = response?.data?.certificate ?? null;
            restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
              ? response.data.restoredCertificates
              : [];
          }
        } catch (error) {
          pushNotification({
            title: "Визит не обновлен",
            message: error?.message || "Не удалось обновить визит в backend",
            persist: false,
          });
          return;
        }

        setVisits((current) =>
          current.map((visit) =>
            visit.id === previousVisit.id ? savedVisit : visit,
          ),
        );
        if (savedEntry) {
          setCalendarEntries((current) =>
            current.map((calendarEntry) =>
              calendarEntry.id === savedEntry.id ? savedEntry : calendarEntry,
            ),
          );
        }
        const clientPackagesToApply = [
          ...restoredClientPackages,
          ...(savedClientPackage ? [savedClientPackage] : []),
        ];
        if (clientPackagesToApply.length > 0) {
          setClientPackages((current) =>
            clientPackagesToApply.reduce(
              (nextPackages, packageItem) =>
                nextPackages.some((item) => item.id === packageItem.id)
                  ? nextPackages.map((item) =>
                      item.id === packageItem.id ? packageItem : item,
                    )
                  : [packageItem, ...nextPackages],
              current,
            ),
          );
        }
        const certificatesToApply = [
          ...restoredCertificates,
          ...(savedCertificate ? [savedCertificate] : []),
        ];
        if (certificatesToApply.length > 0) {
          setCertificates((current) =>
            certificatesToApply.reduce(
              (nextCertificates, certificateItem) =>
                nextCertificates.some((item) => item.id === certificateItem.id)
                  ? nextCertificates.map((item) =>
                      item.id === certificateItem.id ? certificateItem : item,
                    )
                  : [certificateItem, ...nextCertificates],
              current,
            ),
          );
        }
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
      setCalendarEntries,
      setClientPackages,
      setCalendarEntryDefaults,
      setCalendarEntryModalOpen,
      setCertificates,
      setEditingCalendarEntry,
      setEditingJournalVisit,
      setVisits,
    ],
  );

  const deleteCalendarEntry = useCallback(
    async (entry) => {
      const linkedVisit = visits.find(
        (visit) => visit.id === entry.visitId || visit.calendarEntryId === entry.id,
      );
      const paymentName = String(linkedVisit?.payment ?? "").trim().toLowerCase();
      const usesPackage =
        Boolean(linkedVisit?.packageUsageId) ||
        Number(linkedVisit?.packageSessionsUsed) > 0 ||
        paymentName.includes("пакет") ||
        paymentName.includes("pakiet") ||
        paymentName.includes("package");
      const usesCertificate =
        Boolean(linkedVisit?.certificateUsageId) ||
        Number(linkedVisit?.certificateAmountUsed) > 0 ||
        paymentName.includes("сертификат") ||
        paymentName.includes("certyfikat") ||
        paymentName.includes("certificate");

      if (
        entry.status === "completed" &&
        linkedVisit &&
        (usesPackage || usesCertificate)
      ) {
        let response;

        try {
          response = await deleteCompletedCalendarEntry({
            calendarEntryId: entry.id,
            visitId: linkedVisit.id,
          });
        } catch (error) {
          pushNotification({
            title: "Запись не удалена",
            message: error?.message || "Не удалось удалить запись в backend",
            persist: false,
          });
          return;
        }

        const deletedCalendarEntryId = response?.data?.deletedCalendarEntryId ?? entry.id;
        const deletedVisitId = response?.data?.deletedVisitId ?? linkedVisit.id;
        const restoredClientPackages = Array.isArray(response?.data?.restoredClientPackages)
          ? response.data.restoredClientPackages
          : [];
        const restoredCertificates = Array.isArray(response?.data?.restoredCertificates)
          ? response.data.restoredCertificates
          : [];

        setCalendarEntries((current) =>
          current.filter((item) => item.id !== deletedCalendarEntryId),
        );
        setVisits((current) =>
          current.filter(
            (visit) =>
              visit.id !== deletedVisitId &&
              visit.id !== linkedVisit.id &&
              visit.calendarEntryId !== entry.id,
          ),
        );
        if (restoredClientPackages.length > 0) {
          setClientPackages((current) =>
            restoredClientPackages.reduce(
              (nextPackages, restoredPackage) =>
                nextPackages.some((item) => item.id === restoredPackage.id)
                  ? nextPackages.map((item) =>
                      item.id === restoredPackage.id ? restoredPackage : item,
                    )
                  : [restoredPackage, ...nextPackages],
              current,
            ),
          );
        }
        if (restoredCertificates.length > 0) {
          setCertificates((current) =>
            restoredCertificates.reduce(
              (nextCertificates, restoredCertificate) =>
                nextCertificates.some((item) => item.id === restoredCertificate.id)
                  ? nextCertificates.map((item) =>
                      item.id === restoredCertificate.id ? restoredCertificate : item,
                    )
                  : [restoredCertificate, ...nextCertificates],
              current,
            ),
          );
        }

        onCalendarSlotFreed?.(entry);
        pushNotification({
          title: entry.kind === "visit" ? "Запись отменена" : "Резерв удален",
          message: entry.kind === "visit" ? entry.client : entry.title,
        });
        return;
      }

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
      }
      onCalendarSlotFreed?.(entry);
      pushNotification({
        title: entry.kind === "visit" ? "Запись отменена" : "Резерв удален",
        message: entry.kind === "visit" ? entry.client : entry.title,
      });
    },
    [
      onCalendarSlotFreed,
      pushNotification,
      setCalendarEntries,
      setCertificates,
      setClientPackages,
      setVisits,
      visits,
    ],
  );

  const performMoveCalendarEntry = useCallback(
    async (entryId, previousEntry, movedEntry) => {
      await removeCompletedVisitLink(previousEntry, movedEntry);

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
    [removeCompletedVisitLink, setCalendarEntries, syncCompletedCalendarVisit, pushNotification],
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

      // Находим имя мастера для вывода в диалоге подтверждения
      const masterEmployee = employees.find((e) => String(e.id) === String(nextPosition.master));
      const masterName = masterEmployee ? masterEmployee.name : nextPosition.master;

      setPendingCalendarAction({
        type: "move",
        entry: currentEntry,
        nextPosition: { ...nextPosition, masterName }
      });
    },
    [
      appSettings,
      calendarEntries,
      employees,
    ],
  );

  const confirmCalendarConflict = useCallback(async () => {
    if (!pendingCalendarConflict) {
      return;
    }

    const {entry, isEditing, type} = pendingCalendarConflict;

    if (type === "move") {
      const previousEntry = calendarEntries.find((item) => item.id === entry.id);
      await performMoveCalendarEntry(entry.id, previousEntry, entry);
    } else {
      await saveCalendarEntry(entry, isEditing);
    }

    setPendingCalendarConflict(null);
  }, [
    calendarEntries,
    pendingCalendarConflict,
    saveCalendarEntry,
    performMoveCalendarEntry,
  ]);

  const performUpdateCalendarEntryStatus = useCallback(
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

  const updateCalendarEntryStatus = useCallback(
    async (entry, status) => {
      if (status === "cancelled") {
        setPendingCalendarAction({
          type: "cancel_status",
          entry,
          status,
        });
        return;
      }

      await performUpdateCalendarEntryStatus(entry, status);
    },
    [performUpdateCalendarEntryStatus],
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
    } else if (type === "move") {
      const {nextPosition} = pendingCalendarAction;
      const previousEntry = calendarEntries.find((item) => item.id === entry.id);
      const movedEntry = previousEntry
        ? normalizeCalendarEntryTiming({...previousEntry, ...nextPosition}, previousEntry)
        : null;
      if (movedEntry) {
        performMoveCalendarEntry(entry.id, previousEntry, movedEntry);
      }
    } else if (type === "cancel_status") {
      const {status} = pendingCalendarAction;
      performUpdateCalendarEntryStatus(entry, status);
    }

    setPendingCalendarAction(null);
  }, [
    deleteCalendarEntry,
    openEditCalendarEntry,
    pendingCalendarAction,
    calendarEntries,
    performMoveCalendarEntry,
    performUpdateCalendarEntryStatus,
  ]);

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
