import {useCallback, useRef, useState} from "react";
import {
  createWaitlistEntry,
  deleteWaitlistEntry,
  restoreWaitlistEntry,
  updateWaitlistEntry,
} from "../api/waitlist.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {getClientMessageName} from "../utils/clientMessageName.js";
import {resolveAutomatedMessageTemplate} from "../utils/messageTemplates.js";
import {
  buildFreedCalendarSlot,
  buildWaitlistEntry,
  defaultWaitlistOfferTemplate,
  findWaitlistMatches,
  formatWaitlistSlotLabel,
  parseWaitlistEntryDetails,
  personalizeWaitlistOfferTemplate,
} from "../utils/waitlist.js";
import {updateSiteBookingRequest} from "../utils/siteBookingApi.js";

export function useWaitlistHandlers({
  appSettings,
  clientProfiles,
  messageTemplates = [],
  openClientMessageTemplates,
  openCreateCalendarEntry,
  pushNotification,
  serviceCatalog = [],
  setWaitlistEntries,
  waitlistEntries,
}) {
  const [pendingFreedSlot, setPendingFreedSlot] = useState(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [editingWaitlistEntry, setEditingWaitlistEntry] = useState(null);
  const [waitlistDefaults, setWaitlistDefaults] = useState(null);
  const restoringIdsRef = useRef(new Set());

  const closeWaitlistModal = useCallback(() => {
    setWaitlistModalOpen(false);
    setEditingWaitlistEntry(null);
    setWaitlistDefaults(null);
  }, []);

  const openCreateWaitlistEntry = useCallback((defaults = null) => {
    setEditingWaitlistEntry(null);
    setWaitlistDefaults(defaults);
    setWaitlistModalOpen(true);
  }, []);

  const openEditWaitlistEntry = useCallback((entry) => {
    setEditingWaitlistEntry(entry);
    setWaitlistDefaults(null);
    setWaitlistModalOpen(true);
  }, []);

  const saveWaitlistEntry = useCallback(
    async (formValues) => {
      if (editingWaitlistEntry) {
        const nextEntry = {
          ...editingWaitlistEntry,
          note: formValues.note,
          preferredDate: formValues.preferredDate,
          preferredMaster: formValues.preferredMaster,
          preferredService: formValues.preferredService,
          preferredTimeFrom: formValues.preferredTimeFrom,
          preferredTimeTo: formValues.preferredTimeTo,
        };

        let savedEntry;
        try {
          const response = await updateWaitlistEntry(editingWaitlistEntry.id, nextEntry);
          savedEntry = response?.data ?? nextEntry;
        } catch (error) {
          pushNotification({
            title: "Лист ожидания не обновлён",
            message: error?.message || "Backend не принял изменения",
            persist: false,
          });
          return false;
        }

        setWaitlistEntries((current) =>
          current.map((entry) =>
            entry.id === editingWaitlistEntry.id ? savedEntry : entry,
          ),
        );
        pushNotification({
          title: "Лист ожидания обновлён",
          message: savedEntry.clientName,
        });
      } else {
        const nextEntry = buildWaitlistEntry({
          client: formValues.client,
          clientProfiles,
          createId: () => undefined,
          note: formValues.note,
          preferredDate: formValues.preferredDate,
          preferredMaster: formValues.preferredMaster,
          preferredService: formValues.preferredService,
          preferredTimeFrom: formValues.preferredTimeFrom,
          preferredTimeTo: formValues.preferredTimeTo,
        });

        if (!nextEntry) {
          pushNotification({
            title: "Не удалось добавить в лист",
            message: "Выберите клиента из базы",
            tone: "urgent",
          });
          return false;
        }

        let savedEntry;
        try {
          const response = await createWaitlistEntry(nextEntry);
          savedEntry = response?.data ?? nextEntry;
        } catch (error) {
          pushNotification({
            title: "Не удалось добавить в лист",
            message: error?.message || "Backend не принял запись ожидания",
            tone: "urgent",
          });
          return false;
        }

        setWaitlistEntries((current) => [savedEntry, ...current]);
        pushNotification({
          title: "Клиент добавлен в лист ожидания",
          message: savedEntry.clientName,
        });
      }

      closeWaitlistModal();
      return true;
    },
    [
      clientProfiles,
      closeWaitlistModal,
      editingWaitlistEntry,
      pushNotification,
      setWaitlistEntries,
    ],
  );

  const restoreWaitlistEntryHandler = useCallback(
    async (id) => {
      const numericId = Number(id);
      if (!numericId || restoringIdsRef.current.has(numericId)) return;
      restoringIdsRef.current.add(numericId);

      try {
        const response = await restoreWaitlistEntry(numericId);
        const restored = response?.data;
        setWaitlistEntries((current) =>
          current.map((item) => {
            if (Number(item.id) !== numericId) return item;
            if (restored) return restored;
            const prevStatus = item.payload?.previousStatus || "active";
            const nextPayload = { ...(item.payload || {}) };
            delete nextPayload.deletedAt;
            delete nextPayload.previousStatus;
            return { ...item, status: prevStatus, payload: nextPayload };
          }),
        );
        pushNotification({
          title: "Заявка восстановлена",
          message: restored?.clientName || "Запись возвращена в очередь",
          tone: "success",
        });
      } catch (error) {
        pushNotification({
          title: "Не удалось восстановить заявку",
          message: error?.message || "Ошибка сервера",
          persist: false,
        });
      } finally {
        restoringIdsRef.current.delete(numericId);
      }
    },
    [pushNotification, setWaitlistEntries],
  );

  const removeWaitlistEntry = useCallback(
    async (entry) => {
      if (!entry?.id) return;
      const targetId = Number(entry.id);

      try {
        const response = await deleteWaitlistEntry(targetId);
        const deletedEntry = response?.data ?? {
          ...entry,
          status: "deleted",
          payload: {
            ...(entry.payload && typeof entry.payload === "object" ? entry.payload : {}),
            deletedAt: new Date().toISOString(),
            previousStatus: entry.status || "active",
          },
        };

        setWaitlistEntries((current) =>
          current.map((item) => (Number(item.id) === targetId ? deletedEntry : item)),
        );

        pushNotification({
          title: "Заявка удалена",
          message: entry.clientName || "Заявка из очереди",
          tone: "neutral",
          actions: [
            {
              action: "undo_waitlist_delete",
              entityId: targetId,
              label: "Отменить",
              onClick: () => restoreWaitlistEntryHandler(targetId),
            },
          ],
        });
      } catch (error) {
        pushNotification({
          title: "Не удалено из очереди",
          message: error?.message || "Backend не удалил запись",
          persist: false,
        });
      }
    },
    [pushNotification, restoreWaitlistEntryHandler, setWaitlistEntries],
  );

  const markWaitlistOffered = useCallback(
    async (entry, slot) => {
      const nextEntry = {
        ...entry,
        lastOfferedAt: new Date().toISOString(),
        lastOfferedSlot: slot,
        status: "offered",
      };
      try {
        await updateWaitlistEntry(entry.id, nextEntry);
      } catch (error) {
        pushNotification({
          title: "Лист ожидания не обновлён",
          message: error?.message || "Backend не принял предложение слота",
          persist: false,
        });
        return;
      }

      setWaitlistEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? nextEntry : item,
        ),
      );
    },
    [pushNotification, setWaitlistEntries],
  );

  const closeWaitlistOffer = useCallback(() => {
    setPendingFreedSlot(null);
  }, []);

  const notifyCalendarSlotFreed = useCallback(
    (entry) => {
      if (appSettings.waitlistEnabled === false || entry?.kind !== "visit") {
        return;
      }

      const slot = buildFreedCalendarSlot(entry);
      const matches = findWaitlistMatches({
        excludeClientId: entry.clientId,
        slot,
        waitlistEntries,
      });

      if (matches.length > 0) {
        setPendingFreedSlot({matches, slot});
        return;
      }

      pushNotification({
        title: "Слот освободился",
        message: formatWaitlistSlotLabel(slot),
      });
    },
    [appSettings.waitlistEnabled, pushNotification, waitlistEntries],
  );

  const messageWaitlistClient = useCallback(
    (entry, slot) => {
      const client = clientProfiles.find(
        (item) => String(item.id) === String(entry.clientId),
      );

      if (!client) {
        return;
      }

      void markWaitlistOffered(entry, slot);
      openClientMessageTemplates(client);
      closeWaitlistOffer();
    },
    [
      clientProfiles,
      closeWaitlistOffer,
      markWaitlistOffered,
      openClientMessageTemplates,
    ],
  );

  const bookWaitlistClient = useCallback(
    (entry, slot) => {
      void markWaitlistOffered(entry, slot);
      openCreateCalendarEntry({
        client: entry.clientName,
        clientId: entry.clientId,
        date: slot.date,
        kind: "visit",
        master: slot.master || entry.preferredMaster || "",
        service: entry.preferredService || slot.service || "",
        time: slot.time,
      });
      closeWaitlistOffer();
    },
    [closeWaitlistOffer, markWaitlistOffered, openCreateCalendarEntry],
  );

  const buildWaitlistOfferMessage = useCallback(
    (entry, slot) => {
      const client = clientProfiles.find(
        (item) => String(item.id) === String(entry.clientId),
      );

      return personalizeWaitlistOfferTemplate(
        resolveAutomatedMessageTemplate({
          appSettings,
          client,
          defaultTemplate: defaultWaitlistOfferTemplate,
          messageTemplates,
          purpose: "waitlist-offer",
        }),
        {
          clientName: getClientMessageName(client) || entry.clientName,
          master: entry.preferredMaster || slot.master,
          service: entry.preferredService || slot.service,
          slot,
          studio: appSettings.studioName || "NUAR",
        },
      );
    },
    [
      appSettings,
      clientProfiles,
      messageTemplates,
    ],
  );

  const markWaitlistBooked = useCallback(
    async (id, calendarEntry) => {
      if (!id) return;
      const numericId = Number(id);
      const target = waitlistEntries.find((item) => Number(item.id) === numericId);
      if (!target) return;

      const nextEntry = {
        ...target,
        status: "booked",
      };

      try {
        await updateWaitlistEntry(numericId, nextEntry);
        const siteBookingRequestId = target.payload?.siteBookingRequestId;
        if (siteBookingRequestId) {
          await updateSiteBookingRequest(siteBookingRequestId, {
            linked_calendar_entry_id: String(calendarEntry?.id || ""),
            status: "applied",
          });
        }
      } catch (error) {
        console.warn("Failed to finalize booked waitlist entry on backend:", error);
      }

      setWaitlistEntries((current) =>
        current.map((item) => (Number(item.id) === numericId ? nextEntry : item)),
      );
    },
    [setWaitlistEntries, waitlistEntries],
  );

  const bookWaitlistEntryFromPanel = useCallback(
    (entry) => {
      const details = parseWaitlistEntryDetails(entry, clientProfiles);
      const cleanServiceName = String(details.preferredService || "").toLowerCase().trim();
      const matchedService = (serviceCatalog || []).find((s) => {
        const sName = String(s.name || "").toLowerCase().trim();
        return sName === cleanServiceName || sName.includes(cleanServiceName) || cleanServiceName.includes(sName);
      });

      openCreateCalendarEntry({
        amount: details.bookedPrice ?? "",
        client: details.clientName,
        clientId: details.linkedClient?.id || entry.clientId || null,
        date: entry.preferredDate || getTodayInput(),
        duration: details.durationMinutes,
        kind: "visit",
        master: entry.preferredMaster || "",
        note: details.clientComment ? `Заявка: ${details.clientComment}` : "",
        service: entry.preferredService || "",
        serviceId: matchedService?.id || "",
        time: entry.preferredTimeFrom || "10:00",
        waitlistEntryId: entry.id,
      });
    },
    [clientProfiles, openCreateCalendarEntry, serviceCatalog],
  );

  const messageWaitlistEntryFromPanel = useCallback(
    (entry) => {
      const client = clientProfiles.find(
        (item) => String(item.id) === String(entry.clientId),
      );

      if (client) {
        openClientMessageTemplates(client);
      }
    },
    [clientProfiles, openClientMessageTemplates],
  );

  return {
    bookWaitlistClient,
    bookWaitlistEntryFromPanel,
    buildWaitlistOfferMessage,
    closeWaitlistModal,
    closeWaitlistOffer,
    editingWaitlistEntry,
    markWaitlistBooked,
    markWaitlistOffered,
    messageWaitlistClient,
    messageWaitlistEntryFromPanel,
    notifyCalendarSlotFreed,
    openCreateWaitlistEntry,
    openEditWaitlistEntry,
    pendingFreedSlot,
    removeWaitlistEntry,
    restoreWaitlistEntry: restoreWaitlistEntryHandler,
    saveWaitlistEntry,
    waitlistDefaults,
    waitlistModalOpen,
  };
}
