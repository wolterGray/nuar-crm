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
  DAY_CLOSE_STORAGE_KEY,
  PAYROLL_STORAGE_KEY,
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  VISITS_STORAGE_KEY,
  saveScopedValue,
  saveStoredValue,
} from "../utils/crmStorage.js";

export function useCrmLocalPersistence({
  alertSnoozes,
  appSettings,
  authUser = null,
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
  dayCloseRecords,
  payrollRecords,
  tasks,
  visits,
}) {
  useEffect(() => {
    saveScopedValue(VISITS_STORAGE_KEY, visits, authUser);
  }, [visits, authUser]);

  useEffect(() => {
    saveStoredValue(EMPLOYEES_STORAGE_KEY, employees);
  }, [employees]);

  useEffect(() => {
    saveScopedValue(CLIENTS_STORAGE_KEY, clientProfiles, authUser);
  }, [clientProfiles, authUser]);

  useEffect(() => {
    saveStoredValue(SERVICES_STORAGE_KEY, serviceCatalog);
  }, [serviceCatalog]);

  useEffect(() => {
    saveStoredValue(PACKAGES_STORAGE_KEY, packagesCatalog);
  }, [packagesCatalog]);

  useEffect(() => {
    saveScopedValue(CLIENT_PACKAGES_STORAGE_KEY, clientPackages, authUser);
  }, [clientPackages, authUser]);

  useEffect(() => {
    saveScopedValue(CERTIFICATES_STORAGE_KEY, certificates, authUser);
  }, [certificates, authUser]);

  useEffect(() => {
    saveStoredValue(MESSAGE_TEMPLATES_STORAGE_KEY, messageTemplates);
  }, [messageTemplates]);

  useEffect(() => {
    saveScopedValue(CALENDAR_ENTRIES_STORAGE_KEY, calendarEntries, authUser);
  }, [calendarEntries, authUser]);

  useEffect(() => {
    saveStoredValue(DISMISSED_CLIENT_ALERTS_STORAGE_KEY, dismissedClientAlertIds);
  }, [dismissedClientAlertIds]);

  useEffect(() => {
    saveStoredValue(SNOOZED_ALERTS_STORAGE_KEY, alertSnoozes);
  }, [alertSnoozes]);

  useEffect(() => {
    saveScopedValue(COMMUNICATION_LOG_STORAGE_KEY, communicationLog, authUser);
  }, [communicationLog, authUser]);

  useEffect(() => {
    saveStoredValue(NOTIFICATION_INBOX_STORAGE_KEY, notificationInbox);
  }, [notificationInbox]);

  useEffect(() => {
    saveStoredValue(SMS_REMINDER_LOG_STORAGE_KEY, smsReminderLog);
  }, [smsReminderLog]);

  useEffect(() => {
    saveStoredValue(REVIEW_REQUEST_LOG_STORAGE_KEY, reviewRequestLog);
  }, [reviewRequestLog]);

  useEffect(() => {
    saveStoredValue(INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY, inactiveFollowUpLog);
  }, [inactiveFollowUpLog]);

  useEffect(() => {
    saveScopedValue(WAITLIST_STORAGE_KEY, waitlistEntries, authUser);
  }, [waitlistEntries, authUser]);

  useEffect(() => {
    saveScopedValue(DAY_CLOSE_STORAGE_KEY, dayCloseRecords, authUser);
  }, [dayCloseRecords, authUser]);

  useEffect(() => {
    saveScopedValue(PAYROLL_STORAGE_KEY, payrollRecords, authUser);
  }, [payrollRecords, authUser]);

  useLayoutEffect(() => {
    applyColorTheme(appSettings);
  }, [appSettings]);

  useEffect(() => {
    saveStoredValue(TASKS_STORAGE_KEY, tasks);
  }, [tasks]);

  useEffect(() => {
    saveStoredValue(SUPPLIES_STORAGE_KEY, supplies);
  }, [supplies]);

  useEffect(() => {
    saveStoredValue(IMPORT_DOCUMENTS_STORAGE_KEY, importDocuments);
  }, [importDocuments]);

  useEffect(() => {
    saveStoredValue(IMPORTED_MAIL_IDS_STORAGE_KEY, importedMailIds);
  }, [importedMailIds]);

  useEffect(() => {
    saveStoredValue(AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY, autoCompletedCalendarEntryIds);
  }, [autoCompletedCalendarEntryIds]);
}
