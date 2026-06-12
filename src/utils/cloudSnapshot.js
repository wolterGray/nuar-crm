import {pruneExpiredSnoozes} from "./alertSnooze.js";
import {migrateClientLinks} from "./clientLinks.js";
import {mergeLegacyCertificateSales, syncCertificateStatus} from "./certificates.js";

export const applyCrmSnapshot = (
  snapshot,
  {
    applyBooksySources,
    defaultAppSettings,
    normalizeServiceColors,
    setAppSettings,
    setAutoCompletedCalendarEntryIds,
    setCalendarEntries,
    setClientPackages,
    setClientProfiles,
    setCommunicationLog,
    setDismissedClientAlertIds,
    setAlertSnoozes,
    setCertificates,
    setEmployees,
    setImportDocuments,
    setImportedMailIds,
    setMessageTemplates,
    setNotificationInbox,
    setPackagesCatalog,
    setServiceCatalog,
    setSupplies,
    setSmsReminderLog,
    setTasks,
    setVisits,
  },
) => {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const clients = Array.isArray(snapshot.clients)
    ? applyBooksySources(snapshot.clients, snapshot.visits ?? [])
    : null;
  const migrated = clients
    ? migrateClientLinks(clients, {
        visits: snapshot.visits ?? [],
        calendarEntries: snapshot.calendarEntries ?? [],
        clientPackages: snapshot.clientPackages ?? [],
        certificates: snapshot.certificates ?? [],
      })
    : null;

  if (migrated?.visits) setVisits(migrated.visits);
  if (Array.isArray(snapshot.employees)) setEmployees(snapshot.employees);
  if (clients) setClientProfiles(clients);
  if (Array.isArray(snapshot.services)) {
    setServiceCatalog(normalizeServiceColors(snapshot.services));
  }
  if (Array.isArray(snapshot.packages)) setPackagesCatalog(snapshot.packages);
  if (migrated?.clientPackages) setClientPackages(migrated.clientPackages);
  if (setCertificates) {
    const nextCertificates = mergeLegacyCertificateSales(
      migrated?.visits ?? snapshot.visits ?? [],
      migrated?.certificates ??
        (Array.isArray(snapshot.certificates) ? snapshot.certificates : []),
      () => Date.now(),
    ).map(syncCertificateStatus);
    setCertificates(nextCertificates);
  }
  if (Array.isArray(snapshot.messageTemplates)) {
    setMessageTemplates(snapshot.messageTemplates);
  }
  if (migrated?.calendarEntries) setCalendarEntries(migrated.calendarEntries);
  if (Array.isArray(snapshot.dismissedClientAlertIds)) {
    setDismissedClientAlertIds(snapshot.dismissedClientAlertIds);
  }
  if (snapshot.alertSnoozes && typeof snapshot.alertSnoozes === "object") {
    setAlertSnoozes(pruneExpiredSnoozes(snapshot.alertSnoozes));
  }
  if (Array.isArray(snapshot.communicationLog)) {
    setCommunicationLog(snapshot.communicationLog);
  }
  if (Array.isArray(snapshot.notificationInbox)) {
    setNotificationInbox(snapshot.notificationInbox.filter((item) => item.undoAction));
  }
  if (Array.isArray(snapshot.tasks)) setTasks(snapshot.tasks);
  if (Array.isArray(snapshot.supplies)) setSupplies(snapshot.supplies);
  if (Array.isArray(snapshot.importDocuments)) {
    setImportDocuments(snapshot.importDocuments);
  }
  if (Array.isArray(snapshot.importedMailIds)) {
    setImportedMailIds(snapshot.importedMailIds);
  }
  if (Array.isArray(snapshot.autoCompletedCalendarEntryIds)) {
    setAutoCompletedCalendarEntryIds(snapshot.autoCompletedCalendarEntryIds);
  }
  if (Array.isArray(snapshot.smsReminderLog)) {
    setSmsReminderLog(snapshot.smsReminderLog);
  }
  if (snapshot.settings && typeof snapshot.settings === "object") {
    const safeSettings = {...snapshot.settings};
    delete safeSettings.authLogin;
    delete safeSettings.authPassword;
    setAppSettings({
      ...defaultAppSettings,
      ...safeSettings,
      sidebarVisible:
        window.innerWidth <= 700
          ? false
          : safeSettings.sidebarVisible ?? defaultAppSettings.sidebarVisible,
    });
  }
};

export const buildCloudSnapshot = ({
  alertSnoozes,
  appSettings,
  autoCompletedCalendarEntryIds,
  calendarEntries,
  certificates,
  clientPackages,
  clientProfiles,
  communicationLog,
  dismissedClientAlertIds,
  employees,
  importDocuments,
  importedMailIds,
  messageTemplates,
  notificationInbox,
  packagesCatalog,
  serviceCatalog,
  smsReminderLog,
  supplies,
  tasks,
  visits,
}) => ({
  version: 1,
  visits,
  employees,
  clients: clientProfiles,
  services: serviceCatalog,
  packages: packagesCatalog,
  certificates,
  clientPackages,
  messageTemplates,
  calendarEntries,
  dismissedClientAlertIds,
  alertSnoozes,
  communicationLog,
  notificationInbox,
  tasks,
  supplies,
  importDocuments,
  importedMailIds,
  smsReminderLog,
  autoCompletedCalendarEntryIds,
  settings: appSettings,
});
