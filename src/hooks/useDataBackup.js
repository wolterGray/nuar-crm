import {useCallback, useMemo, useState} from "react";
import {validateBackupStructure} from "../utils/backupFormat.js";
import {createBackupSnapshot, restoreBackupSnapshot} from "../utils/backupRestore.js";
import {getTodayInput} from "../utils/dateHelpers.js";

export function useDataBackup({
  collections,
  defaultAppSettings,
  pushNotification,
  setters,
}) {
  const [pendingDataBackup, setPendingDataBackup] = useState(null);
  const backupSetters = useMemo(() => setters, [setters]);

  const exportDataBackup = useCallback(() => {
    const backup = createBackupSnapshot(collections);
    const link = document.createElement("a");
    const date = getTodayInput();

    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], {type: "application/json"}),
    );
    link.download = `nuar-crm-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    pushNotification({
      title: "Резервная копия скачана",
      message: "Локальная база сохранена в JSON-файл",
    });
  }, [collections, pushNotification]);

  const importDataBackup = useCallback(
    async (event) => {
      const [file] = event.target.files ?? [];

      if (!file) {
        return;
      }

      try {
        const backup = JSON.parse(await file.text());
        const validation = validateBackupStructure(backup);

        if (!validation.ok) {
          throw new Error(validation.error);
        }

        setPendingDataBackup(backup);
      } catch (error) {
        pushNotification({
          title: "Не удалось восстановить базу",
          message:
            error?.message || "Выберите JSON-файл резервной копии NUAR CRM",
        });
      } finally {
        event.target.value = "";
      }
    },
    [pushNotification],
  );

  const confirmDataBackupImport = useCallback(() => {
    if (!pendingDataBackup) {
      return;
    }

    restoreBackupSnapshot(pendingDataBackup, {
      defaultAppSettings,
      setters: backupSetters,
    });
    setPendingDataBackup(null);
    pushNotification({
      title: "База восстановлена",
      message: "Данные из резервной копии загружены",
    });
  }, [backupSetters, defaultAppSettings, pendingDataBackup, pushNotification]);

  const cancelDataBackupImport = useCallback(() => {
    setPendingDataBackup(null);
  }, []);

  return {
    cancelDataBackupImport,
    confirmDataBackupImport,
    exportDataBackup,
    importDataBackup,
    pendingDataBackup,
  };
}
