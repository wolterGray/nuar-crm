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

  return {logClientMessage};
}
