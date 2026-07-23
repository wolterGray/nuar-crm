import {useCallback, useEffect, useRef, useState} from "react";
import {
  fetchReviewRequestStatus,
  previewReviewRequests,
  processReviewRequests,
} from "../utils/reviewRequestsApi.js";
import {buildDueReviewRequests} from "../utils/reviewRequests.js";

const ENABLE_AUTOMATION_STATUS =
  import.meta.env.VITE_ENABLE_AUTOMATION_STATUS === "true";

export function useReviewRequests({
  appSettings,
  authSession,
  calendarEntries,
  clientProfiles,
  cloudHydrated,
  messageTemplates = [],
  onRemoteSnapshotRefresh,
  pushNotification,
  reviewRequestLog,
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
    if (!authSession || !appSettings.reviewRequestsEnabled) {
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchReviewRequestStatus();
      setStatus({
        configured: Boolean(remote.configured),
        dueCount: Number(remote.dueCount) || 0,
        lastRunAt:
          remote.lastRunAt || appSettings.reviewRequestLastRunAt || "",
        loading: false,
        recentLog: Array.isArray(remote.recentLog) ? remote.recentLog : [],
        skippedCount: Number(remote.skippedCount) || 0,
      });
    } catch {
      const due = buildDueReviewRequests({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        reviewRequestLog,
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
    reviewRequestLog,
  ]);

  const runProcess = useCallback(async () => {
    if (processingRef.current || !authSession) {
      return null;
    }

    if (!appSettings.reviewRequestsEnabled) {
      pushNotification?.({
        title: "Запросы отзывов выключены",
        message: "Включите запросы отзывов в настройках, чтобы отправлять SMS.",
      });
      return {failed: [], scheduled: [], sent: [], skipped: true};
    }

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const due = buildDueReviewRequests({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        reviewRequestLog,
      });
      const requests = due.filter((item) => item.status === "pending");
      setLocalDue(due);

      if (requests.length === 0) {
        pushNotification({
          title: "Запросы отзывов",
          message: "Сейчас нет запросов к отправке",
        });
        return {failed: [], scheduled: [], sent: []};
      }

      const result = await processReviewRequests({requests});
      const sentCount = Array.isArray(result.sent) ? result.sent.length : 0;
      const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;

      if (sentCount > 0) {
        pushNotification({
          title: "Запросы отзывов отправлены",
          message: `Успешно: ${sentCount}${failedCount ? ` · ошибок: ${failedCount}` : ""}`,
        });
      } else if (failedCount > 0) {
        pushNotification({
          title: "Запросы отзывов не отправились",
          message: `Ошибок: ${failedCount}. Проверьте SMSAPI_TOKEN на backend.`,
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "Запросы отзывов не выполнены",
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
    reviewRequestLog,
  ]);

  const runPreview = useCallback(async () => {
    if (!authSession) {
      const due = buildDueReviewRequests({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        reviewRequestLog,
      });
      setLocalDue(due);
      return due;
    }

    try {
      const result = await previewReviewRequests();
      const due = Array.isArray(result?.due) ? result.due : [];
      setLocalDue(due);
      return due;
    } catch {
      const due = buildDueReviewRequests({
        appSettings,
        calendarEntries,
        clientProfiles,
        messageTemplates,
        reviewRequestLog,
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
    reviewRequestLog,
  ]);

  useEffect(() => {
    if (
      !ENABLE_AUTOMATION_STATUS ||
      !authSession ||
      !cloudHydrated ||
      !appSettings.reviewRequestsEnabled
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    appSettings.reviewRequestsEnabled,
    authSession,
    cloudHydrated,
    refreshStatus,
  ]);

  useEffect(() => {
    if (
      !authSession ||
      !cloudHydrated ||
      !appSettings.reviewRequestsEnabled ||
      appSettings.reviewRequestAutoProcessEnabled === false
    ) {
      return undefined;
    }

    const intervalMinutes = Math.max(
      10,
      Number(appSettings.reviewRequestAutoProcessMinutes) || 15,
    );
    const timer = window.setInterval(() => {
      runProcess();
    }, intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [
    appSettings.reviewRequestAutoProcessEnabled,
    appSettings.reviewRequestAutoProcessMinutes,
    appSettings.reviewRequestsEnabled,
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
