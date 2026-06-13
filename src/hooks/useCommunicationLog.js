import {useCallback} from "react";

export function useCommunicationLog({createLocalId, pushNotification, setCommunicationLog}) {
  const logClientMessage = useCallback(
    ({client, channel, template, body}) => {
      setCommunicationLog((current) => [
        {
          id: createLocalId(),
          clientId: client.id,
          clientName: client.name,
          channel,
          templateName: template.name,
          body,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      pushNotification({
        title: "Контакт записан",
        message: `${client.name} · ${channel}`,
      });
    },
    [createLocalId, pushNotification, setCommunicationLog],
  );

  const logBulkSmsCampaign = useCallback(
    ({entries = [], failedCount = 0, segmentId = "", sentCount = 0}) => {
      if (!entries.length) {
        return;
      }

      const createdAt = new Date().toISOString();

      setCommunicationLog((current) => [
        ...entries.map(({body, channel, client, template}) => ({
          id: createLocalId(),
          clientId: client.id,
          clientName: client.name,
          channel,
          templateName: template?.name ?? "Bulk SMS",
          body,
          createdAt,
        })),
        ...current,
      ]);

      pushNotification({
        title: "Bulk SMS отправлены",
        message: `${segmentId}: ${sentCount}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
      });
    },
    [createLocalId, pushNotification, setCommunicationLog],
  );

  return {logBulkSmsCampaign, logClientMessage};
}
