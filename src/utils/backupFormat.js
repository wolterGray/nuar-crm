export const BACKUP_SCHEMA_VERSION = 1;

export const BACKUP_REQUIRED_COLLECTIONS = [
  "visits",
  "employees",
  "clients",
  "services",
  "packages",
  "clientPackages",
  "messageTemplates",
  "calendarEntries",
];

export const validateBackupStructure = (backup) => {
  if (!backup || typeof backup !== "object") {
    return {
      ok: false,
      error: "Файл не похож на резервную копию NUAR CRM",
    };
  }

  const version = Number(backup.version);

  if (!Number.isFinite(version) || version < 1) {
    return {
      ok: false,
      error: "В файле не указана поддерживаемая версия схемы (version)",
    };
  }

  if (version > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Версия ${version} новее текущей CRM (${BACKUP_SCHEMA_VERSION}). Обновите приложение.`,
    };
  }

  const missingCollection = BACKUP_REQUIRED_COLLECTIONS.find(
    (key) => !Array.isArray(backup[key]),
  );

  if (missingCollection) {
    return {
      ok: false,
      error: `В файле отсутствует или повреждён раздел «${missingCollection}»`,
    };
  }

  if (!backup.settings || typeof backup.settings !== "object") {
    return {
      ok: false,
      error: "В файле нет блока настроек",
    };
  }

  return {ok: true, version};
};

export const getBackupPreview = (backup) => {
  const counts = {
    calendarEntries: backup.calendarEntries?.length ?? 0,
    clientPackages: backup.clientPackages?.length ?? 0,
    clients: backup.clients?.length ?? 0,
    employees: backup.employees?.length ?? 0,
    services: backup.services?.length ?? 0,
    tasks: backup.tasks?.length ?? 0,
    visits: backup.visits?.length ?? 0,
  };

  return {
    counts,
    exportedAt: backup.exportedAt || null,
    version: Number(backup.version) || 1,
  };
};

export const formatBackupExportedAt = (exportedAt) => {
  if (!exportedAt) {
    return "дата не указана";
  }

  const date = new Date(exportedAt);

  return Number.isNaN(date.getTime())
    ? "дата не указана"
    : date.toLocaleString("ru-RU", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};
