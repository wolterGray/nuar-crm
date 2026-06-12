import {useCallback, useEffect, useRef, useState} from "react";
import {defaultAppSettings} from "../constants/appDefaults.js";
import {buildTelegramDigestMessage} from "../utils/telegramDigest.js";
import {
  fetchTelegramDigestStatus,
  previewTelegramDigest,
  sendTelegramDigest,
} from "../utils/telegramDigestApi.js";

export function useTelegramDigest({
  appSettings,
  authSession,
  calendarEntries,
  certificates,
  clientPackages,
  clientProfiles,
  cloudHydrated,
  employees,
  onRemoteSnapshotRefresh,
  pushNotification,
  visits,
}) {
  const [status, setStatus] = useState({
    configured: false,
    lastRunAt: "",
    loading: false,
    previewMessage: "",
  });
  const processingRef = useRef(false);

  const buildLocalPreview = useCallback(() => {
    const {message} = buildTelegramDigestMessage({
      appSettings,
      calendarEntries,
      certificates,
      clientPackages,
      clientProfiles,
      defaultAppSettings,
      employees,
      visits,
    });

    return message;
  }, [
    appSettings,
    calendarEntries,
    certificates,
    clientPackages,
    clientProfiles,
    employees,
    visits,
  ]);

  const refreshStatus = useCallback(async () => {
    if (!authSession || !appSettings.telegramDigestEnabled) {
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchTelegramDigestStatus();
      setStatus({
        configured: Boolean(remote.configured),
        lastRunAt:
          remote.lastRunAt || appSettings.telegramDigestLastRunAt || "",
        loading: false,
        previewMessage: remote.previewMessage || buildLocalPreview(),
      });
    } catch {
      setStatus((current) => ({
        ...current,
        configured: false,
        lastRunAt: appSettings.telegramDigestLastRunAt || "",
        loading: false,
        previewMessage: buildLocalPreview(),
      }));
    }
  }, [appSettings, authSession, buildLocalPreview]);

  const runPreview = useCallback(async () => {
    if (!authSession) {
      const message = buildLocalPreview();
      setStatus((current) => ({...current, previewMessage: message}));
      return message;
    }

    try {
      const result = await previewTelegramDigest();
      const message = String(result?.message ?? buildLocalPreview());
      setStatus((current) => ({...current, previewMessage: message}));
      return message;
    } catch {
      const message = buildLocalPreview();
      setStatus((current) => ({...current, previewMessage: message}));
      return message;
    }
  }, [authSession, buildLocalPreview]);

  const runSend = useCallback(async () => {
    if (processingRef.current || !authSession) {
      return null;
    }

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const result = await sendTelegramDigest();

      if (result?.sent) {
        pushNotification({
          title: "Telegram-дайджест отправлен",
          message: "Сводка дня отправлена в Telegram",
        });
      } else if (result?.skipped) {
        pushNotification({
          title: "Telegram-дайджест не отправлен",
          message: String(result.reason || "Отправка пропущена"),
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "Telegram-дайджест не выполнен",
        message: error?.message || "Не удалось вызвать edge function",
      });
      return null;
    } finally {
      processingRef.current = false;
      setStatus((current) => ({...current, loading: false}));
    }
  }, [authSession, onRemoteSnapshotRefresh, pushNotification, refreshStatus]);

  useEffect(() => {
    if (!authSession || !cloudHydrated || !appSettings.telegramDigestEnabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    appSettings.telegramDigestEnabled,
    authSession,
    cloudHydrated,
    refreshStatus,
  ]);

  return {
    refreshStatus,
    runPreview,
    runSend,
    status,
  };
}
