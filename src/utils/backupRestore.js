import {BACKUP_SCHEMA_VERSION} from "./backupFormat.js";
import {applyBooksySources} from "./booksySources.js";
import {migrateCrmSnapshot} from "./clientLinks.js";
import {normalizeServiceColors} from "./serviceColors.js";

export const createBackupSnapshot = (collections) => ({
  version: BACKUP_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  ...collections,
});

export const restoreBackupSnapshot = (
  backup,
  {defaultAppSettings, setters},
) => {
  const migrated = migrateCrmSnapshot({
    ...backup,
    clients: applyBooksySources(backup.clients, backup.visits),
  });

  setters.setVisits(migrated.visits);
  setters.setEmployees(backup.employees);
  setters.setClientProfiles(migrated.clients);
  setters.setServiceCatalog(normalizeServiceColors(backup.services));
  setters.setPackagesCatalog(backup.packages);
  setters.setClientPackages(migrated.clientPackages);
  setters.setMessageTemplates(backup.messageTemplates);
  setters.setCalendarEntries(migrated.calendarEntries);
  setters.setDismissedClientAlertIds(
    Array.isArray(backup.dismissedClientAlertIds)
      ? backup.dismissedClientAlertIds
      : [],
  );
  setters.setCommunicationLog(
    Array.isArray(backup.communicationLog) ? backup.communicationLog : [],
  );
  setters.setNotificationInbox(
    Array.isArray(backup.notificationInbox) ? backup.notificationInbox : [],
  );
  setters.setTasks(Array.isArray(backup.tasks) ? backup.tasks : []);
  setters.setSupplies(Array.isArray(backup.supplies) ? backup.supplies : []);
  setters.setImportDocuments(
    Array.isArray(backup.importDocuments) ? backup.importDocuments : [],
  );
  setters.setImportedMailIds(
    Array.isArray(backup.importedMailIds) ? backup.importedMailIds : [],
  );
  setters.setAppSettings({...defaultAppSettings, ...backup.settings});
};
