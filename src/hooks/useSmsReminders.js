import {useCallback, useEffect, useRef, useState} from "react";
import {
  fetchSmsReminderStatus,
  previewSmsReminders,
  processSmsReminders,
} from "../utils/smsRemindersApi.js";
import {buildDueSmsReminders} from "../utils/smsReminders.js";

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
    lastRunAt: "",
    loading: false,
    recentLog: [],
    skippedCount: 0,
  });
  const [localDue, setLocalDue] = useState([]);
  const processingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (!authSession || !appSettings.smsRemindersEnabled) {
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchSmsReminderStatus();
      setStatus({
        configured: Boolean(remote.configured),
        dueCount: Number(remote.dueCount) || 0,
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

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const result = await processSmsReminders();
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
          message: `Ошибок: ${failedCount}. Проверьте SMSAPI_TOKEN в Supabase.`,
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "SMS-напоминания не выполнены",
        message: error?.message || "Не удалось вызвать edge function",
      });
      return null;
    } finally {
      processingRef.current = false;
      setStatus((current) => ({...current, loading: false}));
    }
  }, [authSession, onRemoteSnapshotRefresh, pushNotification, refreshStatus]);

  const runPreview = useCallback(async () => {
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
  }, [appSettings, authSession, calendarEntries, clientProfiles, smsReminderLog]);

  useEffect(() => {
    if (!authSession || !cloudHydrated || !appSettings.smsRemindersEnabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    appSettings.smsRemindersEnabled,
    authSession,
    cloudHydrated,
    refreshStatus,
  ]);

  useEffect(() => {
    if (
      !authSession ||
      !cloudHydrated ||
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
