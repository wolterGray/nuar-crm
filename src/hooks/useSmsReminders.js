import {useCallback, useEffect, useRef, useState} from "react";
import {
  fetchSmsReminderStatus,
  previewSmsReminders,
  processSmsReminders,
} from "../utils/smsRemindersApi.js";
import {buildDueSmsReminders} from "../utils/smsReminders.js";

const ENABLE_AUTOMATION_STATUS =
  import.meta.env.VITE_ENABLE_AUTOMATION_STATUS === "true";

const isSmsChannelEnabled = (appSettings) => appSettings.smsEnabled !== false;

export function useSmsReminders({
  appSettings,
  authSession,
  calendarEntries,
  clientProfiles,
  cloudHydrated,
  messageTemplates = [],
  onRemoteSnapshotRefresh,
  pushNotification,
  smsReminderLog,
}) {
  const [status, setStatus] = useState({
    configured: false,
    dueCount: 0,
    enabled: false,
    lastRunAt: "",
    loading: false,
    recentLog: [],
    skippedCount: 0,
  });
  const [localDue, setLocalDue] = useState([]);
  const processingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (
      !authSession ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.smsRemindersEnabled
    ) {
      setStatus((current) => ({
        ...current,
        dueCount: 0,
        enabled: false,
        loading: false,
        skippedCount: 0,
      }));
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchSmsReminderStatus();
      setStatus({
        configured: Boolean(remote.configured),
        dueCount: Number(remote.dueCount) || 0,
        enabled: remote.enabled !== false,
        lastRunAt: remote.lastRunAt || appSettings.smsRemindersLastRunAt || "",
        loading: false,
        recentLog: Array.isArray(remote.recentLog) ? remote.recentLog : [],
        skippedCount: Number(remote.skippedCount) || 0,
      });
    } catch {
      const due = buildDueSmsReminders({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        smsReminderLog,
      });
      setStatus((current) => ({
        ...current,
        configured: false,
        dueCount: due.filter((item) => item.status === "pending").length,
        loading: false,
        skippedCount: due.filter((item) => item.status === "skipped").length,
      }));
      setLocalDue(due);
    }
  }, [
    appSettings,
    authSession,
    calendarEntries,
    clientProfiles,
    messageTemplates,
    smsReminderLog,
  ]);

  const runProcess = useCallback(async () => {
    if (processingRef.current || !authSession) {
      return null;
    }

    if (!isSmsChannelEnabled(appSettings) || !appSettings.smsRemindersEnabled) {
      pushNotification?.({
        title: "SMS-напоминания выключены",
        message: "Включите SMS-напоминания в настройках, чтобы отправлять их.",
      });
      return {failed: [], scheduled: [], sent: [], skipped: true};
    }

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const due = buildDueSmsReminders({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        smsReminderLog,
      });
      const reminders = due
        .filter((item) => item.status === "pending")
        .map((item) => ({
          message: item.message,
          phone: item.phone,
          sendAt: item.sendAt,
        }));
      setLocalDue(due);

      if (reminders.length === 0) {
        pushNotification({
          title: "SMS-напоминания",
          message: "Сейчас нет напоминаний к отправке",
        });
        return {failed: [], scheduled: [], sent: []};
      }

      const result = await processSmsReminders({reminders});
      const sentCount = Array.isArray(result.sent) ? result.sent.length : 0;
      const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;

      if (sentCount > 0) {
        pushNotification({
          title: "SMS-напоминания отправлены",
          message: `Успешно: ${sentCount}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
        });
      } else if (failedCount > 0) {
        pushNotification({
          title: "SMS не отправились",
          message: `Ошибок: ${failedCount}. Проверьте SMSAPI_TOKEN на backend.`,
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "SMS-напоминания не выполнены",
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
    calendarEntries,
    clientProfiles,
    messageTemplates,
    onRemoteSnapshotRefresh,
    pushNotification,
    refreshStatus,
    smsReminderLog,
  ]);

  const runPreview = useCallback(async () => {
    if (!isSmsChannelEnabled(appSettings) || !appSettings.smsRemindersEnabled) {
      setLocalDue([]);
      return [];
    }

    if (!authSession) {
      const due = buildDueSmsReminders({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        smsReminderLog,
      });
      setLocalDue(due);
      return due;
    }

    try {
      const result = await previewSmsReminders();
      const due = Array.isArray(result?.due) ? result.due : [];
      setLocalDue(due);
      return due;
    } catch {
      const due = buildDueSmsReminders({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        smsReminderLog,
      });
      setLocalDue(due);
      return due;
    }
  }, [
    appSettings,
    authSession,
    calendarEntries,
    clientProfiles,
    messageTemplates,
    smsReminderLog,
  ]);

  useEffect(() => {
    if (
      !ENABLE_AUTOMATION_STATUS ||
      !authSession ||
      !cloudHydrated ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.smsRemindersEnabled
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    appSettings,
    appSettings.smsRemindersEnabled,
    authSession,
    cloudHydrated,
    refreshStatus,
  ]);

  useEffect(() => {
    if (
      !authSession ||
      !cloudHydrated ||
      !isSmsChannelEnabled(appSettings) ||
      !appSettings.smsRemindersEnabled ||
      appSettings.smsAutoProcessEnabled === false
    ) {
      return undefined;
    }

    const intervalMinutes = Math.max(
      5,
      Number(appSettings.smsAutoProcessMinutes) || 10,
    );
    const timer = window.setInterval(() => {
      runProcess();
    }, intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [
    appSettings.smsAutoProcessEnabled,
    appSettings.smsAutoProcessMinutes,
    appSettings,
    appSettings.smsRemindersEnabled,
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
