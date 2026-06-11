import {useCallback} from "react";
import {parseSettingsForm} from "../utils/settingsForm.js";

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

  const resetSettings = useCallback(() => {
    setAppSettings(defaultAppSettings);
    pushNotification({
      title: "Настройки сброшены",
      message: "Вернули стандартный вид NUAR",
    });
  }, [defaultAppSettings, pushNotification, setAppSettings]);

  return {
    handleSettingsSubmit,
    resetSettings,
  };
}
