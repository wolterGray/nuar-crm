import {
  initialClients,
  initialEmployees,
  initialPackages,
  initialServices,
  visitsSeed,
} from "../data/seed.js";
import {navItems} from "../constants/navigation.js";
import {
  ACTIVE_PAGE_STORAGE_KEY,
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
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
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  VISITS_STORAGE_KEY,
} from "../constants/storageKeys.js";
import {defaultAppSettings, initialMessageTemplates} from "../constants/appDefaults.js";
import {applyBooksySources} from "./booksySources.js";
import {migrateClientLinks} from "./clientLinks.js";
import {normalizeServiceColors} from "./serviceColors.js";

export const normalizeStoredSettings = (settings = {}) => {
  const safeSettings = {...settings};
  delete safeSettings.authLogin;
  delete safeSettings.authPassword;
  const legacyAccentColors = new Set(["#5e6ad2", "#7c6cf2"]);

  if (
    safeSettings.theme === "light" &&
    (!safeSettings.accentColor || legacyAccentColors.has(safeSettings.accentColor))
  ) {
    safeSettings.theme = defaultAppSettings.theme;
    safeSettings.accentColor = defaultAppSettings.accentColor;
  }

  if (legacyAccentColors.has(safeSettings.accentColor)) {
    safeSettings.accentColor = defaultAppSettings.accentColor;
  }

  return {
    ...defaultAppSettings,
    ...safeSettings,
    sidebarVisible:
      window.innerWidth <= 700 ? false : safeSettings.sidebarVisible ?? true,
  };
};

export const loadStoredVisits = () => {
  try {
    const storedVisits = window.localStorage.getItem(VISITS_STORAGE_KEY);

    if (!storedVisits) {
      return visitsSeed;
    }

    const parsedVisits = JSON.parse(storedVisits);
    return Array.isArray(parsedVisits) ? parsedVisits : visitsSeed;
  } catch {
    return visitsSeed;
  }
};

export const loadStoredActivePage = () => {
  try {
    const storedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    const pageExists = navItems.some((item) => item.page === storedPage);
    return pageExists && storedPage !== "home" ? storedPage : "statistics";
  } catch {
    return "statistics";
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

export const loadStoredClients = () => {
  try {
    const storedClients = window.localStorage.getItem(CLIENTS_STORAGE_KEY);

    if (!storedClients) {
      return applyBooksySources(initialClients, loadStoredVisits());
    }

    const parsedClients = JSON.parse(storedClients);
    return applyBooksySources(
      Array.isArray(parsedClients) ? parsedClients : initialClients,
      loadStoredVisits(),
    );
  } catch {
    return applyBooksySources(initialClients, loadStoredVisits());
  }
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

export const loadStoredClientPackages = () => {
  try {
    const storedClientPackages = window.localStorage.getItem(
      CLIENT_PACKAGES_STORAGE_KEY,
    );

    if (!storedClientPackages) {
      return [];
    }

    const parsedClientPackages = JSON.parse(storedClientPackages);
    return Array.isArray(parsedClientPackages) ? parsedClientPackages : [];
  } catch {
    return [];
  }
};

export const loadStoredMessageTemplates = () => {
  try {
    const storedTemplates = window.localStorage.getItem(
      MESSAGE_TEMPLATES_STORAGE_KEY,
    );

    if (!storedTemplates) {
      return initialMessageTemplates;
    }

    const parsedTemplates = JSON.parse(storedTemplates);
    return Array.isArray(parsedTemplates) ? parsedTemplates : initialMessageTemplates;
  } catch {
    return initialMessageTemplates;
  }
};

export const loadStoredCalendarEntries = () => {
  try {
    const storedEntries = window.localStorage.getItem(CALENDAR_ENTRIES_STORAGE_KEY);
    const parsedEntries = storedEntries ? JSON.parse(storedEntries) : [];

    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
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

export const loadCommunicationLog = () => {
  try {
    const storedLog = window.localStorage.getItem(COMMUNICATION_LOG_STORAGE_KEY);
    const parsedLog = storedLog ? JSON.parse(storedLog) : [];

    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch {
    return [];
  }
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

export const loadStoredSettings = () => {
  try {
    const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return {
        ...defaultAppSettings,
        sidebarVisible: window.innerWidth > 700,
      };
    }

    const parsedSettings = JSON.parse(storedSettings);
    return normalizeStoredSettings(parsedSettings);
  } catch {
    return {
      ...defaultAppSettings,
      sidebarVisible: window.innerWidth > 700,
    };
  }
};

let initialCrmCollectionsCache = null;

export const getInitialCrmCollections = () => {
  if (initialCrmCollectionsCache) {
    return initialCrmCollectionsCache;
  }

  const visits = loadStoredVisits();
  const clients = loadStoredClients();
  const calendarEntries = loadStoredCalendarEntries();
  const clientPackages = loadStoredClientPackages();
  const migrated = migrateClientLinks(clients, {
    visits,
    calendarEntries,
    clientPackages,
  });

  initialCrmCollectionsCache = {
    clients,
    visits: migrated.visits,
    calendarEntries: migrated.calendarEntries,
    clientPackages: migrated.clientPackages,
  };

  return initialCrmCollectionsCache;
};

export {
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  CALENDAR_ENTRIES_STORAGE_KEY,
  CLIENT_PACKAGES_STORAGE_KEY,
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
