import {useCallback} from "react";
import {parseSettingsForm, parseSiteBookingNotifyForm} from "../utils/settingsForm.js";

export function useAppSettingsHandlers({
  appSettings,
  defaultAppSettings,
  pushNotification,
  setAppSettings,
}) {
  const handleSettingsSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);

      setAppSettings(parseSettingsForm(form, appSettings, defaultAppSettings));
      pushNotification({
        title: "Настройки сохранены",
        message: "Кастомизация салона обновлена",
      });
    },
    [appSettings, defaultAppSettings, pushNotification, setAppSettings],
  );

  const handleSiteSettingsSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);

      setAppSettings(parseSiteBookingNotifyForm(form, appSettings));
      pushNotification({
        title: "Настройки сайта сохранены",
        message: "Chat ID и уведомления синхронизируются с облаком",
      });
    },
    [appSettings, pushNotification, setAppSettings],
  );

  const resetSettings = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.confirm === "function" &&
      !window.confirm(
        "Сбросить параметры интерфейса, календаря и уведомлений CRM к стандартным значениям? Подключения интеграций и доступы не изменятся.",
      )
    ) {
      return false;
    }

    setAppSettings((current) => ({
      ...defaultAppSettings,
      studioName: current?.studioName || defaultAppSettings.studioName,
      studioAddress: current?.studioAddress || defaultAppSettings.studioAddress,
      ownerName: current?.ownerName || defaultAppSettings.ownerName,
      smsEnabled: current?.smsEnabled ?? defaultAppSettings.smsEnabled,
      smsSenderName: current?.smsSenderName || defaultAppSettings.smsSenderName,
      smsRemindersLastRunAt: current?.smsRemindersLastRunAt ?? "",
      telegramEnabled: current?.telegramEnabled ?? defaultAppSettings.telegramEnabled,
      telegramChatId: current?.telegramChatId ?? "",
      telegramDigestLastRunAt: current?.telegramDigestLastRunAt ?? "",
      siteBookingNotifyTelegramEnabled:
        current?.siteBookingNotifyTelegramEnabled ??
        defaultAppSettings.siteBookingNotifyTelegramEnabled,
      siteBookingNotifyWhatsappEnabled:
        current?.siteBookingNotifyWhatsappEnabled ??
        defaultAppSettings.siteBookingNotifyWhatsappEnabled,
      ownerNotifyPhone: current?.ownerNotifyPhone ?? "",
      gmailBooksySyncEnabled:
        current?.gmailBooksySyncEnabled ?? defaultAppSettings.gmailBooksySyncEnabled,
      gmailClientId: current?.gmailClientId ?? "",
      reviewGoogleUrl: current?.reviewGoogleUrl ?? "",
      reviewBooksyUrl: current?.reviewBooksyUrl ?? "",
      reviewPrimaryUrl: current?.reviewPrimaryUrl ?? "",
      reviewRequestLastRunAt: current?.reviewRequestLastRunAt ?? "",
      inactiveFollowUpLastRunAt: current?.inactiveFollowUpLastRunAt ?? "",
    }));
    pushNotification({
      title: "Настройки интерфейса сброшены",
      message: "Восстановлены стандартные параметры отображения. Интеграции сохранены.",
    });
    return true;
  }, [defaultAppSettings, pushNotification, setAppSettings]);

  return {
    handleSettingsSubmit,
    handleSiteSettingsSubmit,
    resetSettings,
  };
}
