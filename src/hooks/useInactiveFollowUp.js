import {useCallback, useEffect, useRef, useState} from "react";
import {
  fetchInactiveFollowUpStatus,
  previewInactiveFollowUp,
  processInactiveFollowUp,
} from "../utils/inactiveFollowUpApi.js";
import {buildDueInactiveFollowUps} from "../utils/inactiveFollowUp.js";

const ENABLE_AUTOMATION_STATUS =
  import.meta.env.VITE_ENABLE_AUTOMATION_STATUS === "true";

const isSmsChannelEnabled = (appSettings) => appSettings.smsEnabled === true;

export function useInactiveFollowUp({
  appSettings,
  authSession,
  calendarEntries,
  clientProfiles,
  cloudHydrated,
  inactiveFollowUpLog,
  messageTemplates = [],
  onRemoteSnapshotRefresh,
  pushNotification,
  visits,
}) {
  const [status, setStatus] = useState({
    configured: false,
    dueCount: 0,
    lastRunAt: "",
    loading: false,
    recentLog: [],
    skippedCount: 0,
  });
  const [localDue, setLocalDue] = useState([]);
  const processingRef = useRef(false);

  const buildLocalDue = useCallback(
    () =>
      buildDueInactiveFollowUps({
        appSettings,
        calendarEntries,
        clientProfiles,
        inactiveFollowUpLog,
        messageTemplates,
        visits,
      }),
    [
      appSettings,
      calendarEntries,
      clientProfiles,
      inactiveFollowUpLog,
      messageTemplates,
      visits,
    ],
  );

  const refreshStatus = useCallback(async () => {
    if (
      !authSession ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.inactiveFollowUpEnabled
    ) {
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchInactiveFollowUpStatus();
      setStatus({
        configured: Boolean(remote.configured),
        dueCount: Number(remote.dueCount) || 0,
        lastRunAt:
          remote.lastRunAt || appSettings.inactiveFollowUpLastRunAt || "",
        loading: false,
        recentLog: Array.isArray(remote.recentLog) ? remote.recentLog : [],
        skippedCount: Number(remote.skippedCount) || 0,
      });
    } catch {
      const due = buildLocalDue();
      setStatus((current) => ({
        ...current,
        configured: false,
        dueCount: due.filter((item) => item.status === "pending").length,
        loading: false,
        skippedCount: due.filter((item) => item.status === "skipped").length,
      }));
      setLocalDue(due);
    }
  }, [appSettings, authSession, buildLocalDue]);

  const runProcess = useCallback(async () => {
    if (processingRef.current || !authSession) {
      return null;
    }

    if (!isSmsChannelEnabled(appSettings) || !appSettings.inactiveFollowUpEnabled) {
      pushNotification?.({
        title: "Follow-up выключен",
        message: "Включите общий SMS-канал и follow-up в настройках.",
      });
      return {failed: [], scheduled: [], sent: [], skipped: true};
    }

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const due = buildLocalDue();
      const followUps = due.filter((item) => item.status === "pending");
      setLocalDue(due);

      if (followUps.length === 0) {
        pushNotification({
          title: "Follow-up",
          message: "Сейчас нет follow-up к отправке",
        });
        return {failed: [], scheduled: [], sent: []};
      }

      const result = await processInactiveFollowUp({followUps});
      const sentCount = Array.isArray(result.sent) ? result.sent.length : 0;
      const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;

      if (sentCount > 0) {
        pushNotification({
          title: "Follow-up отправлены",
          message: `Успешно: ${sentCount}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
        });
      } else if (failedCount > 0) {
        pushNotification({
          title: "Follow-up не отправились",
          message: `Ошибок: ${failedCount}. Проверьте SMSAPI_TOKEN на backend.`,
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "Follow-up не выполнен",
        message: error?.message || "Не удалось вызвать backend",
      });
      return null;
    } finally {
      processingRef.current = false;
      setStatus((current) => ({...current, loading: false}));
    }
  }, [
    appSettings,
    authSession,
    buildLocalDue,
    onRemoteSnapshotRefresh,
    pushNotification,
    refreshStatus,
  ]);

  const runPreview = useCallback(async () => {
    if (!authSession) {
      const due = buildLocalDue();
      setLocalDue(due);
      return due;
    }

    try {
      const result = await previewInactiveFollowUp();
      const due = Array.isArray(result?.due) ? result.due : [];
      setLocalDue(due);
      return due;
    } catch {
      const due = buildLocalDue();
      setLocalDue(due);
      return due;
    }
  }, [authSession, buildLocalDue]);

  useEffect(() => {
    if (
      !ENABLE_AUTOMATION_STATUS ||
      !authSession ||
      !cloudHydrated ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.inactiveFollowUpEnabled
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    appSettings,
    appSettings.inactiveFollowUpEnabled,
    authSession,
    cloudHydrated,
    refreshStatus,
  ]);

  useEffect(() => {
    if (
      !authSession ||
      !cloudHydrated ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.inactiveFollowUpEnabled ||
      appSettings.inactiveFollowUpAutoProcessEnabled === false
    ) {
      return undefined;
    }

    const intervalMinutes = Math.max(
      30,
      Number(appSettings.inactiveFollowUpAutoProcessMinutes) || 60,
    );
    const timer = window.setInterval(() => {
      runProcess();
    }, intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [
    appSettings.inactiveFollowUpAutoProcessEnabled,
    appSettings.inactiveFollowUpAutoProcessMinutes,
    appSettings,
    appSettings.inactiveFollowUpEnabled,
    authSession,
    cloudHydrated,
    runProcess,
  ]);

  return {
    localDue,
    refreshStatus,
    runPreview,
    runProcess,
    status,
  };
}
