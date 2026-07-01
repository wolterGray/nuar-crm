import {useCallback} from "react";
import {createCommunicationLogEntry} from "../api/operations.js";

export function useCommunicationLog({pushNotification, setCommunicationLog}) {
  const logClientMessage = useCallback(
    async ({client, channel, template, body}) => {
      const entry = {
        clientId: client.id,
        clientName: client.name,
        channel,
        templateName: template.name,
        body,
        createdAt: new Date().toISOString(),
      };

      try {
        const response = await createCommunicationLogEntry(entry);
        const savedEntry = response?.data ?? entry;
        setCommunicationLog((current) => [savedEntry, ...current]);
      } catch (error) {
        pushNotification({
          title: "Контакт не записан",
          message: error?.message || "Backend не принял запись коммуникации",
          persist: false,
        });
        return;
      }

      pushNotification({
        title: "Контакт записан",
        message: `${client.name} · ${channel}`,
      });
    },
    [pushNotification, setCommunicationLog],
  );

  const logBulkSmsCampaign = useCallback(
    async ({entries = [], failedCount = 0, segmentId = "", sentCount = 0}) => {
      if (!entries.length) {
        return;
      }

      const createdAt = new Date().toISOString();
      const logEntries = entries.map(({body, channel, client, template}) => ({
        clientId: client.id,
        clientName: client.name,
        channel,
        templateName: template?.name ?? "Bulk SMS",
        body,
        createdAt,
      }));
      let savedEntries;

      try {
        savedEntries = await Promise.all(
          logEntries.map((entry) =>
            createCommunicationLogEntry(entry).then((response) => response?.data ?? entry),
          ),
        );
      } catch (error) {
        pushNotification({
          title: "Bulk SMS не записаны в журнал",
          message: error?.message || "Backend не принял журнал коммуникаций",
          persist: false,
        });
        return;
      }

      setCommunicationLog((current) => [
        ...savedEntries,
        ...current,
      ]);

      pushNotification({
        title: "Bulk SMS отправлены",
        message: `${segmentId}: ${sentCount}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
      });
    },
    [pushNotification, setCommunicationLog],
  );

  return {logBulkSmsCampaign, logClientMessage};
}
