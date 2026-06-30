import {useCallback} from "react";

export function useCloudSaveActions({
  forceCloudSave,
  manualCloudRestore,
  overwriteRemoteSnapshot,
  pushNotification,
}) {
  const handleForceCloudSave = useCallback(async () => {
    try {
      await forceCloudSave();
      pushNotification({
        title: "Облако обновлено",
        message: "Данные CRM сохранены в Supabase",
      });
    } catch (error) {
      if (error?.message === "Облако обновилось на другом устройстве") {
        return;
      }

      pushNotification({
        title: "Сохранение не удалось",
        message: error?.message || "Не удалось сохранить данные в облако",
      });
    }
  }, [forceCloudSave, pushNotification]);

  const handleApplyRemoteSnapshot = useCallback(async () => {
    try {
      await manualCloudRestore();
      pushNotification({
        title: "Данные загружены",
        message: "Локальная база заменена версией из облака",
      });
    } catch (error) {
      pushNotification({
        title: "Загрузка не удалась",
        message: error?.message || "Не удалось загрузить данные из облака",
      });
    }
  }, [manualCloudRestore, pushNotification]);

  const handleOverwriteRemoteSnapshot = useCallback(async () => {
    try {
      await overwriteRemoteSnapshot();
      pushNotification({
        title: "Облако перезаписано",
        message: "Локальная версия сохранена в Supabase",
      });
    } catch (error) {
      pushNotification({
        title: "Сохранение не удалось",
        message: error?.message || "Не удалось перезаписать облако",
      });
    }
  }, [overwriteRemoteSnapshot, pushNotification]);

  return {
    handleApplyRemoteSnapshot,
    handleForceCloudSave,
    handleOverwriteRemoteSnapshot,
  };
}
