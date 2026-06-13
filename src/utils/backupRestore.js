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
  if (setters.setCertificates) {
    setters.setCertificates(
      Array.isArray(migrated.certificates) ? migrated.certificates : [],
    );
  }
  if (setters.setSmsReminderLog) {
    setters.setSmsReminderLog(
      Array.isArray(backup.smsReminderLog) ? backup.smsReminderLog : [],
    );
  }
  if (setters.setReviewRequestLog) {
    setters.setReviewRequestLog(
      Array.isArray(backup.reviewRequestLog) ? backup.reviewRequestLog : [],
    );
  }
  if (setters.setInactiveFollowUpLog) {
    setters.setInactiveFollowUpLog(
      Array.isArray(backup.inactiveFollowUpLog) ? backup.inactiveFollowUpLog : [],
    );
  }
  if (setters.setWaitlistEntries) {
    setters.setWaitlistEntries(
      Array.isArray(backup.waitlistEntries) ? backup.waitlistEntries : [],
    );
  }
  if (setters.setDayCloseRecords) {
    setters.setDayCloseRecords(
      Array.isArray(backup.dayCloseRecords) ? backup.dayCloseRecords : [],
    );
  }
  if (setters.setPayrollRecords) {
    setters.setPayrollRecords(
      Array.isArray(backup.payrollRecords) ? backup.payrollRecords : [],
    );
  }
  setters.setMessageTemplates(backup.messageTemplates);
  setters.setCalendarEntries(migrated.calendarEntries);
  setters.setDismissedClientAlertIds(
    Array.isArray(backup.dismissedClientAlertIds)
      ? backup.dismissedClientAlertIds
      : [],
  );
  if (setters.setAlertSnoozes) {
    setters.setAlertSnoozes(
      backup.alertSnoozes && typeof backup.alertSnoozes === "object"
        ? backup.alertSnoozes
        : {},
    );
  }
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
