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
    setAppSettings(defaultAppSettings);
    pushNotification({
      title: "Настройки сброшены",
      message: "Вернули стандартный вид NUAR",
    });
  }, [defaultAppSettings, pushNotification, setAppSettings]);

  return {
    handleSettingsSubmit,
    handleSiteSettingsSubmit,
    resetSettings,
  };
}
