import {
  initialClients,
  initialEmployees,
  initialPackages,
  initialServices,
  visitsSeed,
} from "../data/seed.js";
import {navItems} from "../constants/navigation.js";
import {isMobileViewport, MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";
import {
  ACTIVE_PAGE_STORAGE_KEY,
  ALERT_FILTER_STORAGE_KEY,
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
  CERTIFICATES_STORAGE_KEY,
  SMS_REMINDER_LOG_STORAGE_KEY,
  REVIEW_REQUEST_LOG_STORAGE_KEY,
  INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY,
  WAITLIST_STORAGE_KEY,
  DAY_CLOSE_STORAGE_KEY,
  PAYROLL_STORAGE_KEY,
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
  SETTINGS_STORAGE_KEY,
  SNOOZED_ALERTS_STORAGE_KEY,
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  VISITS_STORAGE_KEY,
} from "../constants/storageKeys.js";
import {defaultAppSettings, initialMessageTemplates} from "../constants/appDefaults.js";
import {mergeAutomatedMessageTemplates} from "./messageTemplates.js";
import {syncSettingsWithColorTheme} from "./colorTheme.js";
import {applyBooksySources} from "./booksySources.js";
import {migrateClientLinks} from "./clientLinks.js";
import {mergeLegacyCertificateSales, syncCertificateStatus} from "./certificates.js";
import {normalizeServiceColors} from "./serviceColors.js";

export const getPersonalUiPreferencesKey = (user = null) => {
  const scope = typeof user === "string" ? user : getStorageScope(user);
  return `nuar_crm_ui_prefs_${scope}`;
};

export const loadPersonalUiPreferences = (user = null) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(getPersonalUiPreferencesKey(user));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const prefs = {};
    if (typeof parsed.colorTheme === "string" && parsed.colorTheme) {
      prefs.colorTheme = parsed.colorTheme;
    }
    if (typeof parsed.compactMode === "boolean") {
      prefs.compactMode = parsed.compactMode;
    }
    return prefs;
  } catch {
    return {};
  }
};

export const savePersonalUiPreferences = (settings = {}, user = null) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const synced = syncSettingsWithColorTheme(settings);
    const payload = {
      colorTheme: synced.colorTheme,
      compactMode: Boolean(synced.compactMode ?? true),
    };
    window.localStorage.setItem(
      getPersonalUiPreferencesKey(user),
      JSON.stringify(payload),
    );
    return true;
  } catch {
    return false;
  }
};

export const normalizeStoredSettings = (settings = {}, user = null) => {
  const safeSettings = {...settings};
  delete safeSettings.authLogin;
  delete safeSettings.authPassword;
  const personalPrefs = loadPersonalUiPreferences(user);

  return syncSettingsWithColorTheme({
    ...defaultAppSettings,
    ...safeSettings,
    ...personalPrefs,
    sidebarVisible:
      window.innerWidth <= MOBILE_MAX_WIDTH ? false : safeSettings.sidebarVisible ?? true,
  });
};

export const SENSITIVE_STORAGE_KEYS = new Set([
  VISITS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
  CERTIFICATES_STORAGE_KEY,
  DAY_CLOSE_STORAGE_KEY,
  PAYROLL_STORAGE_KEY,
  COMMUNICATION_LOG_STORAGE_KEY,
  WAITLIST_STORAGE_KEY,
]);

export const getActiveAuthUser = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem("nuar_crm_auth_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
};

export const getStorageScope = (user) => {
  const target = user || getActiveAuthUser();
  if (!target) return "owner";
  const role = String(target.role || "").toLowerCase();
  if (role === "owner" || target.id === "local-admin") {
    return "owner";
  }
  const id = target.id ?? target.employeeId ?? "unknown";
  return `staff_${id}`;
};

export const getScopedKey = (baseKey, user) => {
  const scope = typeof user === "string" ? user : getStorageScope(user);
  return `nuar_crm_${scope}_${baseKey}`;
};

export const loadScopedCollection = (key, user, fallback = []) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return typeof fallback === "function" ? fallback() : fallback;
    }
    const isSensitive = SENSITIVE_STORAGE_KEYS.has(key);
    if (!isSensitive) {
      const raw = window.localStorage.getItem(key);
      if (!raw) return typeof fallback === "function" ? fallback() : fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (typeof fallback === "function" ? fallback() : fallback);
    }

    const scope = typeof user === "string" ? user : getStorageScope(user);
    const scopedKey = getScopedKey(key, scope);

    if (scope === "owner") {
      const scopedRaw = window.localStorage.getItem(scopedKey);
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        return Array.isArray(parsed) ? parsed : (typeof fallback === "function" ? fallback() : fallback);
      }
      // Non-destructive migration from legacy baseKey: read & copy to scoped key without deleting legacy
      const legacyRaw = window.localStorage.getItem(key);
      if (legacyRaw) {
        try {
          window.localStorage.setItem(scopedKey, legacyRaw);
        } catch {
          // ignore quota error
        }
        const parsed = JSON.parse(legacyRaw);
        return Array.isArray(parsed) ? parsed : (typeof fallback === "function" ? fallback() : fallback);
      }
      return typeof fallback === "function" ? fallback() : fallback;
    }

    // Staff / guest scope: read only their scoped partition, never leak owner data
    const staffRaw = window.localStorage.getItem(scopedKey);
    if (staffRaw) {
      const parsed = JSON.parse(staffRaw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch {
    return typeof fallback === "function" ? fallback() : fallback;
  }
};

export const saveScopedValue = (key, value, user) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const isSensitive = SENSITIVE_STORAGE_KEYS.has(key);
    if (!isSensitive) {
      return saveStoredValue(key, value);
    }

    const scope = typeof user === "string" ? user : getStorageScope(user);
    const scopedKey = getScopedKey(key, scope);

    if (scope === "owner") {
      saveStoredValue(scopedKey, value);
      // Keep legacy base key synchronized for backward compatibility
      return saveStoredValue(key, value);
    }

    // Staff: write ONLY to their scoped partition
    return saveStoredValue(scopedKey, value);
  } catch (error) {
    console.warn("CRM scoped cache write failed", { key, message: error?.message || String(error) });
    return false;
  }
};

export const loadStoredVisits = (user = null) => {
  return loadScopedCollection(VISITS_STORAGE_KEY, user, visitsSeed);
};

export const loadStoredActivePage = () => {
  try {
    const storedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    const pageExists = navItems.some((item) => item.page === storedPage);
    const defaultPage = isMobileViewport() ? "today" : "calendar";

    return pageExists && storedPage !== "home" ? storedPage : defaultPage;
  } catch {
    return isMobileViewport() ? "today" : "calendar";
  }
};

export const loadStoredEmployees = () => {
  try {
    const storedEmployees = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY);

    if (!storedEmployees) {
      return initialEmployees;
    }

    const parsedEmployees = JSON.parse(storedEmployees);
    return Array.isArray(parsedEmployees) ? parsedEmployees : initialEmployees;
  } catch {
    return initialEmployees;
  }
};

export const loadStoredClients = (user = null) => {
  return loadScopedCollection(CLIENTS_STORAGE_KEY, user, () =>
    applyBooksySources(initialClients, loadStoredVisits(user)),
  );
};

export const loadStoredServices = () => {
  try {
    const storedServices = window.localStorage.getItem(SERVICES_STORAGE_KEY);

    if (!storedServices) {
      return normalizeServiceColors(initialServices);
    }

    const parsedServices = JSON.parse(storedServices);
    return Array.isArray(parsedServices)
      ? normalizeServiceColors(parsedServices)
      : normalizeServiceColors(initialServices);
  } catch {
    return normalizeServiceColors(initialServices);
  }
};

export const loadStoredPackages = () => {
  try {
    const storedPackages = window.localStorage.getItem(PACKAGES_STORAGE_KEY);

    if (!storedPackages) {
      return initialPackages;
    }

    const parsedPackages = JSON.parse(storedPackages);
    return Array.isArray(parsedPackages) ? parsedPackages : initialPackages;
  } catch {
    return initialPackages;
  }
};

export const loadStoredClientPackages = (user = null) => {
  return loadScopedCollection(CLIENT_PACKAGES_STORAGE_KEY, user, []);
};

export const loadStoredCertificates = (user = null) => {
  return loadScopedCollection(CERTIFICATES_STORAGE_KEY, user, []);
};

export const loadStoredSmsReminderLog = () => {
  try {
    const storedLog = window.localStorage.getItem(SMS_REMINDER_LOG_STORAGE_KEY);

    if (!storedLog) {
      return [];
    }

    const parsedLog = JSON.parse(storedLog);
    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch {
    return [];
  }
};

export const loadStoredReviewRequestLog = () => {
  try {
    const storedLog = window.localStorage.getItem(REVIEW_REQUEST_LOG_STORAGE_KEY);

    if (!storedLog) {
      return [];
    }

    const parsedLog = JSON.parse(storedLog);
    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch {
    return [];
  }
};

export const loadStoredInactiveFollowUpLog = () => {
  try {
    const storedLog = window.localStorage.getItem(INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY);

    if (!storedLog) {
      return [];
    }

    const parsedLog = JSON.parse(storedLog);
    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch {
    return [];
  }
};

export const loadStoredWaitlistEntries = (user = null) => {
  return loadScopedCollection(WAITLIST_STORAGE_KEY, user, []);
};

export const loadStoredDayCloseRecords = (user = null) => {
  return loadScopedCollection(DAY_CLOSE_STORAGE_KEY, user, []);
};

export const loadStoredPayrollRecords = (user = null) => {
  return loadScopedCollection(PAYROLL_STORAGE_KEY, user, []);
};

export const loadStoredMessageTemplates = () => {
  try {
    const storedTemplates = window.localStorage.getItem(
      MESSAGE_TEMPLATES_STORAGE_KEY,
    );

    if (!storedTemplates) {
      return mergeAutomatedMessageTemplates(initialMessageTemplates);
    }

    const parsedTemplates = JSON.parse(storedTemplates);
    return mergeAutomatedMessageTemplates(
      Array.isArray(parsedTemplates) ? parsedTemplates : initialMessageTemplates,
    );
  } catch {
    return mergeAutomatedMessageTemplates(initialMessageTemplates);
  }
};

export const loadStoredCalendarEntries = (user = null) => {
  return loadScopedCollection(CALENDAR_ENTRIES_STORAGE_KEY, user, []);
};

export const loadDismissedClientAlerts = () => {
  try {
    const storedAlerts = window.localStorage.getItem(
      DISMISSED_CLIENT_ALERTS_STORAGE_KEY,
    );

    const parsedAlerts = storedAlerts ? JSON.parse(storedAlerts) : [];

    return Array.isArray(parsedAlerts)
      ? parsedAlerts.map((item) =>
          typeof item === "number" ? `inactive-${item}` : item,
        )
      : [];
  } catch {
    return [];
  }
};

export const loadAlertSnoozes = () => {
  try {
    const storedSnoozes = window.localStorage.getItem(SNOOZED_ALERTS_STORAGE_KEY);
    const parsedSnoozes = storedSnoozes ? JSON.parse(storedSnoozes) : {};

    return parsedSnoozes && typeof parsedSnoozes === "object" ? parsedSnoozes : {};
  } catch {
    return {};
  }
};

export const loadStoredAlertFilter = () => {
  try {
    const storedFilter = window.localStorage.getItem(ALERT_FILTER_STORAGE_KEY);

    if (
      ["urgent", "all", "closing", "finance", "operations", "clients"].includes(
        storedFilter,
      )
    ) {
      return storedFilter;
    }

    return "urgent";
  } catch {
    return "urgent";
  }
};

export const loadCommunicationLog = (user = null) => {
  return loadScopedCollection(COMMUNICATION_LOG_STORAGE_KEY, user, []);
};

export const loadNotificationInbox = () => {
  try {
    const storedInbox = window.localStorage.getItem(NOTIFICATION_INBOX_STORAGE_KEY);
    const parsedInbox = storedInbox ? JSON.parse(storedInbox) : [];

    return Array.isArray(parsedInbox)
      ? parsedInbox.filter((notification) => notification.undoAction)
      : [];
  } catch {
    return [];
  }
};

export const loadStoredCollection = (key) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredValue = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("CRM local cache write failed", {
      key,
      message: error?.message || String(error),
    });
    return false;
  }
};

export const loadStoredSettings = () => {
  try {
    const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return {
        ...defaultAppSettings,
        sidebarVisible: window.innerWidth > MOBILE_MAX_WIDTH,
      };
    }

    const parsedSettings = JSON.parse(storedSettings);
    return normalizeStoredSettings(parsedSettings);
  } catch {
    return {
      ...defaultAppSettings,
      sidebarVisible: window.innerWidth > MOBILE_MAX_WIDTH,
    };
  }
};

let initialCrmCollectionsCacheByScope = {};

export const clearCrmCollectionsCache = () => {
  initialCrmCollectionsCacheByScope = {};
};

export const getInitialCrmCollections = (user = null) => {
  const scope = getStorageScope(user);
  if (initialCrmCollectionsCacheByScope[scope]) {
    return initialCrmCollectionsCacheByScope[scope];
  }

  if (scope !== "owner") {
    // For staff users: load strictly staff-scoped data (or empty array), never initial seed or legacy owner data
    const collections = {
      clients: loadStoredClients(user),
      visits: loadStoredVisits(user),
      calendarEntries: loadStoredCalendarEntries(user),
      clientPackages: loadStoredClientPackages(user),
      certificates: loadStoredCertificates(user),
    };
    initialCrmCollectionsCacheByScope[scope] = collections;
    return collections;
  }

  const visits = loadStoredVisits(user);
  const clients = loadStoredClients(user);
  const calendarEntries = loadStoredCalendarEntries(user);
  const clientPackages = loadStoredClientPackages(user);
  const certificates = loadStoredCertificates(user);
  const migrated = migrateClientLinks(clients, {
    visits,
    calendarEntries,
    clientPackages,
    certificates,
  });

  const collections = {
    clients,
    visits: migrated.visits,
    calendarEntries: migrated.calendarEntries,
    clientPackages: migrated.clientPackages,
    certificates: mergeLegacyCertificateSales(
      migrated.visits,
      migrated.certificates ?? loadStoredCertificates(user),
      () => Date.now(),
    ).map(syncCertificateStatus),
  };

  initialCrmCollectionsCacheByScope[scope] = collections;
  return collections;
};

export {
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
  CERTIFICATES_STORAGE_KEY,
  SMS_REMINDER_LOG_STORAGE_KEY,
  REVIEW_REQUEST_LOG_STORAGE_KEY,
  INACTIVE_FOLLOW_UP_LOG_STORAGE_KEY,
  WAITLIST_STORAGE_KEY,
  DAY_CLOSE_STORAGE_KEY,
  PAYROLL_STORAGE_KEY,
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
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  VISITS_STORAGE_KEY,
};
