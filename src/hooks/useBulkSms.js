import {useCallback, useEffect, useRef, useState} from "react";
import {
  buildBulkSmsRecipients,
  defaultBulkSmsTemplate,
  summarizeBulkSmsRecipients,
} from "../utils/bulkSms.js";
import {
  fetchBulkSmsStatus,
  sendBulkSmsCampaign,
} from "../utils/bulkSmsApi.js";

export function useBulkSms({
  appSettings,
  authSession,
  calendarEntries,
  clientPackages,
  clientProfiles,
  logBulkSmsCampaign,
  pushNotification,
  visits,
}) {
  const [status, setStatus] = useState({
    configured: false,
    loading: false,
    maxRecipients: 100,
  });
  const [preview, setPreview] = useState([]);
  const [segmentId, setSegmentId] = useState("inactive_30");
  const [template, setTemplate] = useState(defaultBulkSmsTemplate);
  const [templateName, setTemplateName] = useState("Bulk SMS");
  const sendingRef = useRef(false);

  const buildPreview = useCallback(
    (nextSegmentId = segmentId, nextTemplate = template) => {
      const recipients = buildBulkSmsRecipients({
        appSettings,
        calendarEntries,
        clientPackages,
        clientProfiles,
        segmentId: nextSegmentId,
        template: nextTemplate,
        visits,
      });

      setPreview(recipients);
      return recipients;
    },
    [
      appSettings,
      calendarEntries,
      clientPackages,
      clientProfiles,
      segmentId,
      template,
      visits,
    ],
  );

  const refreshStatus = useCallback(async () => {
    if (!authSession) {
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchBulkSmsStatus();
      setStatus({
        configured: Boolean(remote.configured),
        loading: false,
        maxRecipients: Number(remote.maxRecipients) || 100,
      });
    } catch {
      setStatus((current) => ({
        ...current,
        configured: false,
        loading: false,
      }));
    }
  }, [authSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshStatus]);

  const runSend = useCallback(async () => {
    if (sendingRef.current || !authSession) {
      return null;
    }

    const recipients = preview.length
      ? preview
      : buildPreview(segmentId, template);
    const summary = summarizeBulkSmsRecipients(recipients);

    if (summary.readyCount === 0) {
      pushNotification({
        title: "Bulk SMS не отправлены",
        message: "В сегменте нет клиентов с телефоном",
      });
      return null;
    }

    if (summary.readyCount > status.maxRecipients) {
      pushNotification({
        title: "Слишком много получателей",
        message: `Максимум ${status.maxRecipients} SMS за один запуск`,
      });
      return null;
    }

    sendingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const result = await sendBulkSmsCampaign({
        recipients,
        segmentId,
        templateName,
      });
      const sent = Array.isArray(result.sent) ? result.sent : [];
      const failed = Array.isArray(result.failed) ? result.failed : [];

      if (sent.length > 0) {
        logBulkSmsCampaign?.({
          entries: sent.map((item) => ({
            body: String(item.message ?? ""),
            channel: "SMS",
            client: clientProfiles.find(
              (client) => String(client.id) === String(item.clientId),
            ) ?? {
              id: item.clientId,
              name: item.clientName,
            },
            template: {name: `${templateName} · ${segmentId}`},
          })),
          failedCount: failed.length,
          segmentId,
          sentCount: sent.length,
        });
      } else {
        pushNotification({
          title: "Bulk SMS не отправились",
          message: failed[0]?.error || "Проверьте SMSAPI_TOKEN в Supabase",
        });
      }

      return result;
    } catch (error) {
      pushNotification({
        title: "Bulk SMS не выполнен",
        message: error?.message || "Не удалось вызвать edge function",
      });
      return null;
    } finally {
      sendingRef.current = false;
      setStatus((current) => ({...current, loading: false}));
    }
  }, [
    authSession,
    buildPreview,
    clientProfiles,
    logBulkSmsCampaign,
    preview,
    pushNotification,
    segmentId,
    status.maxRecipients,
    template,
    templateName,
  ]);

  return {
    buildPreview,
    preview,
    refreshStatus,
    runSend,
    segmentId,
    setPreview,
    setSegmentId,
    setTemplate,
    setTemplateName,
    status,
    template,
  };
}
