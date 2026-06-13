import {useCallback, useState} from "react";
import {getTodayInput} from "../utils/dateHelpers.js";
import {getClientMessageName} from "../utils/clientMessageName.js";
import {
  buildFreedCalendarSlot,
  buildWaitlistEntry,
  findWaitlistMatches,
  formatWaitlistSlotLabel,
  personalizeWaitlistOfferTemplate,
} from "../utils/waitlist.js";

export function useWaitlistHandlers({
  appSettings,
  clientProfiles,
  createLocalId,
  openClientMessageTemplates,
  openCreateCalendarEntry,
  pushNotification,
  setWaitlistEntries,
  waitlistEntries,
}) {
  const [pendingFreedSlot, setPendingFreedSlot] = useState(null);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [editingWaitlistEntry, setEditingWaitlistEntry] = useState(null);
  const [waitlistDefaults, setWaitlistDefaults] = useState(null);

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
    (formValues) => {
      if (editingWaitlistEntry) {
        setWaitlistEntries((current) =>
          current.map((entry) =>
            entry.id === editingWaitlistEntry.id
              ? {
                  ...entry,
                  note: formValues.note,
                  preferredDate: formValues.preferredDate,
                  preferredMaster: formValues.preferredMaster,
                  preferredService: formValues.preferredService,
                  preferredTimeFrom: formValues.preferredTimeFrom,
                  preferredTimeTo: formValues.preferredTimeTo,
                }
              : entry,
          ),
        );
        pushNotification({
          title: "Лист ожидания обновлён",
          message: editingWaitlistEntry.clientName,
        });
      } else {
        const nextEntry = buildWaitlistEntry({
          client: formValues.client,
          clientProfiles,
          createId: createLocalId,
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

        setWaitlistEntries((current) => [nextEntry, ...current]);
        pushNotification({
          title: "Клиент добавлен в лист ожидания",
          message: nextEntry.clientName,
        });
      }

      closeWaitlistModal();
      return true;
    },
    [
      clientProfiles,
      closeWaitlistModal,
      createLocalId,
      editingWaitlistEntry,
      pushNotification,
      setWaitlistEntries,
    ],
  );

  const removeWaitlistEntry = useCallback(
    (entry) => {
      setWaitlistEntries((current) => current.filter((item) => item.id !== entry.id));
      pushNotification({
        title: "Удалено из листа ожидания",
        message: entry.clientName,
      });
    },
    [pushNotification, setWaitlistEntries],
  );

  const markWaitlistOffered = useCallback(
    (entry, slot) => {
      setWaitlistEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                lastOfferedAt: new Date().toISOString(),
                lastOfferedSlot: slot,
                status: "offered",
              }
            : item,
        ),
      );
    },
    [setWaitlistEntries],
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

      markWaitlistOffered(entry, slot);
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
      markWaitlistOffered(entry, slot);
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
        appSettings.waitlistOfferTemplate,
        {
          clientName: getClientMessageName(client) || entry.clientName,
          master: entry.preferredMaster || slot.master,
          service: entry.preferredService || slot.service,
          slot,
          studio: appSettings.studioName || "NUAR",
        },
      );
    },
    [appSettings.studioName, appSettings.waitlistOfferTemplate, clientProfiles],
  );

  const bookWaitlistEntryFromPanel = useCallback(
    (entry) => {
      openCreateCalendarEntry({
        client: entry.clientName,
        clientId: entry.clientId,
        date: entry.preferredDate || getTodayInput(),
        kind: "visit",
        master: entry.preferredMaster || "",
        service: entry.preferredService || "",
        time: entry.preferredTimeFrom || "10:00",
      });
    },
    [openCreateCalendarEntry],
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
    markWaitlistOffered,
    messageWaitlistClient,
    messageWaitlistEntryFromPanel,
    notifyCalendarSlotFreed,
    openCreateWaitlistEntry,
    openEditWaitlistEntry,
    pendingFreedSlot,
    removeWaitlistEntry,
    saveWaitlistEntry,
    waitlistDefaults,
    waitlistModalOpen,
  };
}
