import {useCallback, useEffect, useLayoutEffect, useRef} from "react";
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
  getStorageScope,
  savePersonalUiPreferences,
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
  const currentScope = authUser ? getStorageScope(authUser) : null;
  const prevScopeRef = useRef(currentScope);
  const hadAuthSessionRef = useRef(Boolean(authUser));

  const canWriteScoped = useCallback(() => {
    if (!authUser && hadAuthSessionRef.current) return false;
    if (prevScopeRef.current !== currentScope) return false;
    return true;
  }, [authUser, currentScope]);

  const canWriteOwnerShared = useCallback(() => {
    if (!authUser && hadAuthSessionRef.current) return false;
    if (prevScopeRef.current !== currentScope) return false;
    if (authUser && currentScope !== "owner") return false;
    return true;
  }, [authUser, currentScope]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(VISITS_STORAGE_KEY, visits, authUser);
    }
  }, [visits, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(EMPLOYEES_STORAGE_KEY, employees);
    }
  }, [employees, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(CLIENTS_STORAGE_KEY, clientProfiles, authUser);
    }
  }, [clientProfiles, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(SERVICES_STORAGE_KEY, serviceCatalog);
    }
  }, [serviceCatalog, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(PACKAGES_STORAGE_KEY, packagesCatalog);
    }
  }, [packagesCatalog, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(CLIENT_PACKAGES_STORAGE_KEY, clientPackages, authUser);
    }
  }, [clientPackages, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(CERTIFICATES_STORAGE_KEY, certificates, authUser);
    }
  }, [certificates, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(MESSAGE_TEMPLATES_STORAGE_KEY, messageTemplates);
    }
  }, [messageTemplates, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(CALENDAR_ENTRIES_STORAGE_KEY, calendarEntries, authUser);
    }
  }, [calendarEntries, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(DISMISSED_CLIENT_ALERTS_STORAGE_KEY, dismissedClientAlertIds);
    }
  }, [dismissedClientAlertIds, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(SNOOZED_ALERTS_STORAGE_KEY, alertSnoozes);
    }
  }, [alertSnoozes, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(COMMUNICATION_LOG_STORAGE_KEY, communicationLog, authUser);
    }
  }, [communicationLog, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(NOTIFICATION_INBOX_STORAGE_KEY, notificationInbox);
    }
  }, [notificationInbox, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(SMS_REMINDER_LOG_STORAGE_KEY, smsReminderLog);
    }
  }, [smsReminderLog, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(REVIEW_REQUEST_LOG_STORAGE_KEY, reviewRequestLog);
    }
  }, [reviewRequestLog, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY, inactiveFollowUpLog);
    }
  }, [inactiveFollowUpLog, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(WAITLIST_STORAGE_KEY, waitlistEntries, authUser);
    }
  }, [waitlistEntries, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(DAY_CLOSE_STORAGE_KEY, dayCloseRecords, authUser);
    }
  }, [dayCloseRecords, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteScoped()) {
      saveScopedValue(PAYROLL_STORAGE_KEY, payrollRecords, authUser);
    }
  }, [payrollRecords, authUser, canWriteScoped]);

  useLayoutEffect(() => {
    applyColorTheme(appSettings);
    if (canWriteScoped()) {
      savePersonalUiPreferences(appSettings, authUser);
    }
  }, [appSettings, authUser, canWriteScoped]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(TASKS_STORAGE_KEY, tasks);
    }
  }, [tasks, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(SUPPLIES_STORAGE_KEY, supplies);
    }
  }, [supplies, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(IMPORT_DOCUMENTS_STORAGE_KEY, importDocuments);
    }
  }, [importDocuments, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(IMPORTED_MAIL_IDS_STORAGE_KEY, importedMailIds);
    }
  }, [importedMailIds, canWriteOwnerShared]);

  useEffect(() => {
    if (canWriteOwnerShared()) {
      saveStoredValue(AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY, autoCompletedCalendarEntryIds);
    }
  }, [autoCompletedCalendarEntryIds, canWriteOwnerShared]);

  useEffect(() => {
    if (authUser) {
      hadAuthSessionRef.current = true;
    }
    prevScopeRef.current = currentScope;
  }, [authUser, currentScope]);
}
