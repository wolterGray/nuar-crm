import {useCallback, useEffect, useRef, useState} from "react";
import {defaultAppSettings} from "../constants/appDefaults.js";
import {buildTelegramDigestMessage} from "../utils/telegramDigest.js";
import {
  fetchTelegramDigestStatus,
  previewTelegramDigest,
  sendTelegramDigest,
} from "../utils/telegramDigestApi.js";

const ENABLE_AUTOMATION_STATUS =
  import.meta.env.VITE_ENABLE_AUTOMATION_STATUS === "true";

const isTelegramChannelEnabled = (appSettings) => appSettings.telegramEnabled === true;

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
    enabled: false,
    lastRunAt: "",
    loading: false,
    previewMessage: "",
    telegramChatIdConfigured: false,
    telegramTokenConfigured: false,
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
    if (
      !authSession ||
      !isTelegramChannelEnabled(appSettings) ||
      !appSettings.telegramDigestEnabled
    ) {
      setStatus((current) => ({
        ...current,
        configured: false,
        enabled: false,
        loading: false,
      }));
      return;
    }

    setStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchTelegramDigestStatus();
      setStatus({
        configured: Boolean(remote.configured),
        enabled: remote.enabled !== false,
        lastRunAt:
          remote.lastRunAt || appSettings.telegramDigestLastRunAt || "",
        loading: false,
        previewMessage: remote.previewMessage || buildLocalPreview(),
        telegramChatIdConfigured: Boolean(remote.telegramChatIdConfigured),
        telegramTokenConfigured: Boolean(remote.telegramTokenConfigured),
      });
    } catch (error) {
      setStatus((current) => ({
        ...current,
        configured: false,
        lastRunAt: appSettings.telegramDigestLastRunAt || "",
        loading: false,
        previewMessage: buildLocalPreview(),
      }));
      pushNotification?.({
        title: "Telegram status недоступен",
        message:
          error?.message ||
          "Проверьте backend, TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID",
      });
    }
  }, [appSettings, authSession, buildLocalPreview, pushNotification]);

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

    if (
      !isTelegramChannelEnabled(appSettings) ||
      !appSettings.telegramDigestEnabled
    ) {
      pushNotification?.({
        title: "Telegram-дайджест выключен",
        message: "Включите общий Telegram-канал и Telegram-дайджест в настройках.",
      });
      return {sent: false, skipped: true, reason: "telegram_disabled"};
    }

    processingRef.current = true;
    setStatus((current) => ({...current, loading: true}));

    try {
      const result = await sendTelegramDigest({
        chatId: appSettings.telegramChatId,
        text: buildLocalPreview(),
      });
      const resultError = String(result?.error ?? "").trim();

      if (resultError) {
        pushNotification({
          title: "Telegram-дайджест не выполнен",
          message: resultError,
        });
      } else if (result?.success || result?.sent) {
        pushNotification({
          title: "Telegram-дайджест отправлен",
          message: "Сводка дня отправлена в Telegram",
        });
      } else if (result?.skipped) {
        pushNotification({
          title: "Telegram-дайджест не отправлен",
          message: String(result.reason || "Отправка пропущена"),
        });
      } else if (result?.success === false) {
        pushNotification({
          title: "Telegram-дайджест не выполнен",
          message: "Проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.",
        });
      }

      await onRemoteSnapshotRefresh?.();
      await refreshStatus();
      return result;
    } catch (error) {
      pushNotification({
        title: "Telegram-дайджест не выполнен",
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
    buildLocalPreview,
    onRemoteSnapshotRefresh,
    pushNotification,
    refreshStatus,
  ]);

  useEffect(() => {
    if (
      !ENABLE_AUTOMATION_STATUS ||
      !authSession ||
      !cloudHydrated ||
      !isTelegramChannelEnabled(appSettings) ||
      !appSettings.telegramDigestEnabled
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [appSettings, appSettings.telegramDigestEnabled, authSession, cloudHydrated, refreshStatus]);

  return {
    refreshStatus,
    runPreview,
    runSend,
    status,
  };
}
