import {useEffect, useLayoutEffect} from "react";
import {SNOOZED_ALERTS_STORAGE_KEY} from "../constants/storageKeys.js";
import {applyColorTheme} from "../utils/colorTheme.js";
import {
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
  CERTIFICATES_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  COMMUNICATION_LOG_STORAGE_KEY,
  DISMISSED_CLIENT_ALERTS_STORAGE_KEY,
  EMPLOYEES_STORAGE_KEY,
  IMPORT_DOCUMENTS_STORAGE_KEY,
  IMPORTED_MAIL_IDS_STORAGE_KEY,
  MESSAGE_TEMPLATES_STORAGE_KEY,
  NOTIFICATION_INBOX_STORAGE_KEY,
  PACKAGES_STORAGE_KEY,
  SERVICES_STORAGE_KEY,
  SMS_REMINDER_LOG_STORAGE_KEY,
  REVIEW_REQUEST_LOG_STORAGE_KEY,
  INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY,
  WAITLIST_STORAGE_KEY,
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  VISITS_STORAGE_KEY,
} from "../utils/crmStorage.js";

export function useCrmLocalPersistence({
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
  supplies,
  smsReminderLog,
  reviewRequestLog,
  inactiveFollowUpLog,
  waitlistEntries,
  tasks,
  visits,
}) {
  useEffect(() => {
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    window.localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clientProfiles));
  }, [clientProfiles]);

  useEffect(() => {
    window.localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(serviceCatalog));
  }, [serviceCatalog]);

  useEffect(() => {
    window.localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(packagesCatalog));
  }, [packagesCatalog]);

  useEffect(() => {
    window.localStorage.setItem(
      CLIENT_PACKAGES_STORAGE_KEY,
      JSON.stringify(clientPackages),
    );
  }, [clientPackages]);

  useEffect(() => {
    window.localStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(certificates));
  }, [certificates]);

  useEffect(() => {
    window.localStorage.setItem(
      MESSAGE_TEMPLATES_STORAGE_KEY,
      JSON.stringify(messageTemplates),
    );
  }, [messageTemplates]);

  useEffect(() => {
    window.localStorage.setItem(
      CALENDAR_ENTRIES_STORAGE_KEY,
      JSON.stringify(calendarEntries),
    );
  }, [calendarEntries]);

  useEffect(() => {
    window.localStorage.setItem(
      DISMISSED_CLIENT_ALERTS_STORAGE_KEY,
      JSON.stringify(dismissedClientAlertIds),
    );
  }, [dismissedClientAlertIds]);

  useEffect(() => {
    window.localStorage.setItem(
      SNOOZED_ALERTS_STORAGE_KEY,
      JSON.stringify(alertSnoozes),
    );
  }, [alertSnoozes]);

  useEffect(() => {
    window.localStorage.setItem(
      COMMUNICATION_LOG_STORAGE_KEY,
      JSON.stringify(communicationLog),
    );
  }, [communicationLog]);

  useEffect(() => {
    window.localStorage.setItem(
      NOTIFICATION_INBOX_STORAGE_KEY,
      JSON.stringify(notificationInbox),
    );
  }, [notificationInbox]);

  useEffect(() => {
    window.localStorage.setItem(SMS_REMINDER_LOG_STORAGE_KEY, JSON.stringify(smsReminderLog));
  }, [smsReminderLog]);

  useEffect(() => {
    window.localStorage.setItem(
      REVIEW_REQUEST_LOG_STORAGE_KEY,
      JSON.stringify(reviewRequestLog),
    );
  }, [reviewRequestLog]);

  useEffect(() => {
    window.localStorage.setItem(
      INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY,
      JSON.stringify(inactiveFollowUpLog),
    );
  }, [inactiveFollowUpLog]);

  useEffect(() => {
    window.localStorage.setItem(
      WAITLIST_STORAGE_KEY,
      JSON.stringify(waitlistEntries),
    );
  }, [waitlistEntries]);

  useLayoutEffect(() => {
    applyColorTheme(appSettings);
  }, [appSettings]);

  useEffect(() => {
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem(SUPPLIES_STORAGE_KEY, JSON.stringify(supplies));
  }, [supplies]);

  useEffect(() => {
    window.localStorage.setItem(
      IMPORT_DOCUMENTS_STORAGE_KEY,
      JSON.stringify(importDocuments),
    );
  }, [importDocuments]);

  useEffect(() => {
    window.localStorage.setItem(
      IMPORTED_MAIL_IDS_STORAGE_KEY,
      JSON.stringify(importedMailIds),
    );
  }, [importedMailIds]);

  useEffect(() => {
    window.localStorage.setItem(
      AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
      JSON.stringify(autoCompletedCalendarEntryIds),
    );
  }, [autoCompletedCalendarEntryIds]);
}
