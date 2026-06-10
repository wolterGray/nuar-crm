import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import LoginPage from "./components/LoginPage.jsx";
import SystemScreen from "./components/SystemScreen.jsx";
import AppShell from "./components/AppShell.jsx";
import AppNavigation from "./components/AppNavigation.jsx";
import NotificationDrawer from "./components/NotificationDrawer.jsx";
import AppModals from "./components/AppModals.jsx";
import ToastStack from "./components/ToastStack.jsx";
import {PageNotificationsProvider} from "./components/PageNotifications.jsx";
import "./App.css";
import {
  initialEmployees,
  initialClients,
  initialPackages,
  initialServices,
  visitsSeed,
} from "./data/seed.js";
import {
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
} from "./utils/formatters.jsx";
import {getEmployeePayout, toVisitNumber} from "./utils/visits.jsx";
import {getPackageProgressLabel} from "./utils/packages.jsx";
import {
  getRandomServiceColor,
  getServiceColor,
  normalizeServiceColors,
  serviceColorPalette,
} from "./utils/serviceColors.js";
import EmployeesPage from "./components/EmployeesPage.jsx";
import ClientsPage from "./components/pages/ClientsPage.jsx";
import PackagesPage from "./components/pages/PackagesPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import ServicesPage from "./components/pages/ServicesPage.jsx";
import MessageTemplatesPage from "./components/pages/MessageTemplatesPage.jsx";
import CalendarPage from "./components/pages/CalendarPage.jsx";
import StatisticsPage from "./components/pages/StatisticsPage.jsx";
import PaymentsPage from "./components/pages/PaymentsPage.jsx";
import OperationsPage from "./components/pages/OperationsPage.jsx";
import ImportPage from "./components/pages/ImportPage.jsx";
import SitePage from "./components/pages/SitePage.jsx";
import {isSupabaseConfigured, supabase} from "./lib/supabase.js";
import {mobileNavItems, navItems} from "./constants/navigation.js";
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
} from "./constants/storageKeys.js";
import {usePersistentState} from "./hooks/usePersistentState.js";
let localIdSequence = 0;
const createLocalId = () => Date.now() * 1000 + ++localIdSequence;
const initialMessageTemplates = [
  {
    id: 1,
    name: "Возвращение клиента",
    channel: "SMS",
    language: "Русский",
    audience: "Все",
    subject: "",
    body: "Здравствуйте, {name}! Давно вас не видели в NUAR. Будем рады подобрать удобное время для массажа.",
  },
  {
    id: 2,
    name: "Powrót do salonu",
    channel: "SMS",
    language: "Польский",
    audience: "Поляки",
    subject: "",
    body: "Dzień dobry, {name}! Dawno nie widzieliśmy się w NUAR. Chętnie znajdziemy dogodny termin masażu.",
  },
  {
    id: 3,
    name: "We miss you",
    channel: "Email",
    language: "Английский",
    audience: "Англичане",
    subject: "Your next massage at NUAR",
    body: "Hello, {name}! We have not seen you at NUAR for a while. Reply to this message and we will find a convenient time for your next massage.",
  },
  {
    id: 4,
    name: "Напоминание для девушек",
    channel: "SMS",
    language: "Русский",
    audience: "Девушки",
    subject: "",
    body: "Здравствуйте, {name}! Приглашаем вас снова уделить время себе. В NUAR поможем подобрать удобное окно.",
  },
  {
    id: 5,
    name: "Напоминание для парней",
    channel: "SMS",
    language: "Русский",
    audience: "Парни",
    subject: "",
    body: "Здравствуйте, {name}! Пора восстановиться после нагрузки. Напишите нам, и подберём удобное время для массажа.",
  },
];
const defaultAppSettings = {
  studioName: "NUAR",
  ownerName: "Влад",
  accentColor: "#5e6ad2",
  theme: "dark",
  sidebarVisible: true,
  compactMode: true,
  animationsEnabled: true,
  notificationsEnabled: true,
  taskAlertsEnabled: true,
  supplyAlertsEnabled: true,
  inactiveClientAlertsEnabled: true,
  inactiveClientDays: 14,
  birthdayAlertsEnabled: true,
  birthdayReminderDays: 7,
  todayVisitAlertsEnabled: true,
  todayVisitAlertMode: "remaining",
  upcomingVisitMinutes: 180,
  smartVisitPopupsEnabled: true,
  smartVisitPopupMinutes: 15,
  calendarRemindersVisible: true,
  calendarShowTasks: true,
  calendarNowLineVisible: true,
  calendarConflictWarnings: true,
  workdayStart: "08:00",
  workdayEnd: "22:00",
  calendarSlotMinutes: 15,
  gmailClientId: "",
};
const getTodayInput = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMinutesFromTime = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const isCalendarVisitPlanned = (entry, now = new Date()) => {
  if (["completed", "cancelled", "no_show"].includes(entry.status)) {
    return false;
  }

  const today = getTodayInput();

  if ((entry.date || today) < today) {
    return false;
  }

  if ((entry.date || today) > today) {
    return true;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes > nowMinutes;
};

const isCalendarVisitCompleted = (entry, now = new Date()) => {
  if (
    entry.kind !== "visit" ||
    ["cancelled", "no_show"].includes(entry.status)
  ) {
    return false;
  }

  if (entry.status === "completed") {
    return true;
  }

  const today = getTodayInput();

  if ((entry.date || today) < today) {
    return true;
  }

  if ((entry.date || today) > today) {
    return false;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes <= nowMinutes;
};

const DEFAULT_STATS_DATE = getTodayInput();

const getUpcomingBirthday = (birthday) => {
  const [, month, day] = String(birthday ?? "").split("-").map(Number);

  if (!month || !day) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let nextBirthday = new Date(today.getFullYear(), month - 1, day);

  if (nextBirthday < startOfToday) {
    nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const daysLeft = Math.round((nextBirthday - startOfToday) / (24 * 60 * 60 * 1000));

  return {
    daysLeft,
    label: daysLeft === 0 ? "Сегодня" : `Через ${daysLeft} дн.`,
    date: nextBirthday.toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit"}),
  };
};

const loadStoredVisits = () => {
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

const applyBooksySources = (clients, visits) => {
  const booksyClients = new Set(
    visits
      .filter((visit) => visit.commissionType === "Booksy 45%")
      .map((visit) => visit.client),
  );

  return clients.map((client) =>
    booksyClients.has(client.name) && client.source !== "Booksy"
      ? {...client, source: "Booksy"}
      : client,
  );
};

const loadStoredActivePage = () => {
  try {
    const storedPage = window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    const pageExists = navItems.some((item) => item.page === storedPage);
    return pageExists && storedPage !== "home" ? storedPage : "statistics";
  } catch {
    return "statistics";
  }
};

const loadStoredEmployees = () => {
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
const loadStoredClients = () => {
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

const loadStoredServices = () => {
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

const loadStoredPackages = () => {
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

const loadStoredClientPackages = () => {
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

const loadStoredMessageTemplates = () => {
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

const loadStoredCalendarEntries = () => {
  try {
    const storedEntries = window.localStorage.getItem(CALENDAR_ENTRIES_STORAGE_KEY);
    const parsedEntries = storedEntries ? JSON.parse(storedEntries) : [];

    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
};

const loadDismissedClientAlerts = () => {
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

const loadCommunicationLog = () => {
  try {
    const storedLog = window.localStorage.getItem(COMMUNICATION_LOG_STORAGE_KEY);
    const parsedLog = storedLog ? JSON.parse(storedLog) : [];

    return Array.isArray(parsedLog) ? parsedLog : [];
  } catch {
    return [];
  }
};

const loadNotificationInbox = () => {
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

const loadStoredCollection = (key) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeStoredSettings = (settings = {}) => {
  const safeSettings = {...settings};
  delete safeSettings.authLogin;
  delete safeSettings.authPassword;
  const oldDefaultAccents = new Set(["#d2ad7d", "#7c6cf2"]);

  if (
    safeSettings.theme === "light" &&
    (!safeSettings.accentColor || oldDefaultAccents.has(safeSettings.accentColor))
  ) {
    safeSettings.theme = defaultAppSettings.theme;
    safeSettings.accentColor = defaultAppSettings.accentColor;
  }

  if (oldDefaultAccents.has(safeSettings.accentColor)) {
    safeSettings.accentColor = defaultAppSettings.accentColor;
  }

  return {
    ...defaultAppSettings,
    ...safeSettings,
    sidebarVisible:
      window.innerWidth <= 700 ? false : safeSettings.sidebarVisible ?? true,
  };
};

const loadStoredSettings = () => {
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

function App() {
  const [visits, setVisits] = useState(loadStoredVisits);
  const [employees, setEmployees] = useState(loadStoredEmployees);
  const [clientProfiles, setClientProfiles] = useState(loadStoredClients);
  const [serviceCatalog, setServiceCatalog] = useState(loadStoredServices);
  const [packagesCatalog, setPackagesCatalog] = useState(loadStoredPackages);
  const [clientPackages, setClientPackages] = useState(loadStoredClientPackages);
  const [messageTemplates, setMessageTemplates] = useState(
    loadStoredMessageTemplates,
  );
  const [calendarEntries, setCalendarEntries] = useState(loadStoredCalendarEntries);
  const [dismissedClientAlertIds, setDismissedClientAlertIds] = useState(
    loadDismissedClientAlerts,
  );
  const [communicationLog, setCommunicationLog] = useState(loadCommunicationLog);
  const [notificationInbox, setNotificationInbox] = useState(loadNotificationInbox);
  const [tasks, setTasks] = useState(() => loadStoredCollection(TASKS_STORAGE_KEY));
  const [supplies, setSupplies] = useState(() => loadStoredCollection(SUPPLIES_STORAGE_KEY));
  const [importDocuments, setImportDocuments] = useState(() =>
    loadStoredCollection(IMPORT_DOCUMENTS_STORAGE_KEY),
  );
  const [importedMailIds, setImportedMailIds] = useState(() =>
    loadStoredCollection(IMPORTED_MAIL_IDS_STORAGE_KEY),
  );
  const [autoCompletedCalendarEntryIds, setAutoCompletedCalendarEntryIds] =
    useState(() => loadStoredCollection(AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY));
  const [appSettings, setAppSettings] = usePersistentState(
    SETTINGS_STORAGE_KEY,
    loadStoredSettings,
    {
      deserialize: (value) => normalizeStoredSettings(JSON.parse(value)),
    },
  );
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => window.location.pathname === "/reset-password",
  );
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState("");
  const [activePage, setActivePage] = usePersistentState(
    ACTIVE_PAGE_STORAGE_KEY,
    loadStoredActivePage,
    {
      deserialize: (value) => {
        const pageExists = navItems.some((item) => item.page === value);
        return pageExists && value !== "home" ? value : "statistics";
      },
      serialize: (value) => value,
    },
  );
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [clientPackageModalOpen, setClientPackageModalOpen] = useState(false);
  const [messageTemplateModalOpen, setMessageTemplateModalOpen] = useState(false);
  const [calendarEntryModalOpen, setCalendarEntryModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [financialOperationModalOpen, setFinancialOperationModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingClientPackage, setEditingClientPackage] = useState(null);
  const [editingMessageTemplate, setEditingMessageTemplate] = useState(null);
  const [editingCalendarEntry, setEditingCalendarEntry] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingSupply, setEditingSupply] = useState(null);
  const [openPaymentActionMenuId, setOpenPaymentActionMenuId] = useState(null);
  const [paymentFilters, setPaymentFilters] = useState({
    master: "",
    payment: "",
    client: "",
    date: "",
  });
  const [calendarEntryDefaults, setCalendarEntryDefaults] = useState({});
  const [pendingCalendarAction, setPendingCalendarAction] = useState(null);
  const [pendingPaymentDelete, setPendingPaymentDelete] = useState(null);
  const [pendingCalendarConflict, setPendingCalendarConflict] = useState(null);
  const [pendingDataBackup, setPendingDataBackup] = useState(null);
  const [clientAlertsOpen, setClientAlertsOpen] = useState(false);
  const [notificationSlot, setNotificationSlot] = useState(null);
  const [alertGroupsOpen, setAlertGroupsOpen] = useState({
    system: false,
    calendar: false,
    birthdays: false,
    inactive: false,
    operations: false,
    packages: false,
    forecast: false,
  });
  const [activeClientAlertId, setActiveClientAlertId] = useState(null);
  const [preferredMessageClientId, setPreferredMessageClientId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [pullRefresh, setPullRefresh] = useState({
    distance: 0,
    refreshing: false,
  });
  const contentRef = useRef(null);
  const pullStartYRef = useRef(0);
  const pullTrackingRef = useRef(false);
  const notificationQueueRef = useRef([]);
  const notificationTimerRef = useRef(null);
  const notificationVisibleRef = useRef(false);
  const smartVisitAlertIds = useRef(new Set());
  const autoCompletedCalendarEntryIdsRef = useRef(
    new Set(autoCompletedCalendarEntryIds),
  );
  const cloudSnapshotRef = useRef(null);
  const masters = useMemo(
    () =>
      employees
        .filter((employee) => employee.status !== "Архив")
        .map((employee) => employee.name),
    [employees],
  );

  const clientNames = useMemo(
    () => clientProfiles.map((client) => client.name),
    [clientProfiles],
  );

  const inactiveClientDays = Math.max(
    1,
    Number(appSettings.inactiveClientDays) || defaultAppSettings.inactiveClientDays,
  );

  useEffect(() => {
    autoCompletedCalendarEntryIdsRef.current = new Set(autoCompletedCalendarEntryIds);
  }, [autoCompletedCalendarEntryIds]);

  const isPullRefreshBlocked = useCallback(
    () =>
      employeeModalOpen ||
      clientModalOpen ||
      serviceModalOpen ||
      packageModalOpen ||
      clientPackageModalOpen ||
      messageTemplateModalOpen ||
      calendarEntryModalOpen ||
      taskModalOpen ||
      supplyModalOpen ||
      financialOperationModalOpen ||
      clientAlertsOpen,
    [
      calendarEntryModalOpen,
      clientAlertsOpen,
      clientModalOpen,
      clientPackageModalOpen,
      employeeModalOpen,
      financialOperationModalOpen,
      messageTemplateModalOpen,
      packageModalOpen,
      serviceModalOpen,
      supplyModalOpen,
      taskModalOpen,
    ],
  );

  const getScrollableParent = useCallback((target) => {
    const root = contentRef.current;
    let current = target instanceof Element ? target : null;

    while (current && current !== root && current !== document.body) {
      const style = window.getComputedStyle(current);
      const canScroll =
        /(auto|scroll)/.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight + 1;

      if (canScroll) {
        return current;
      }

      current = current.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }, []);

  const handlePullRefreshStart = useCallback(
    (event) => {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();

      if (
        pullRefresh.refreshing ||
        isPullRefreshBlocked() ||
        !window.matchMedia("(max-width: 700px)").matches ||
        ["input", "textarea", "select", "button"].includes(tagName)
      ) {
        pullTrackingRef.current = false;
        return;
      }

      const scrollParent = getScrollableParent(target);
      const scrollTop =
        scrollParent === document.scrollingElement ||
        scrollParent === document.documentElement
          ? window.scrollY || scrollParent.scrollTop
          : scrollParent.scrollTop;

      pullTrackingRef.current = scrollTop <= 0;
      pullStartYRef.current = event.touches[0]?.clientY ?? 0;
    },
    [getScrollableParent, isPullRefreshBlocked, pullRefresh.refreshing],
  );

  const handlePullRefreshMove = useCallback((event) => {
    if (!pullTrackingRef.current) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? 0;
    const delta = currentY - pullStartYRef.current;

    if (delta <= 0) {
      setPullRefresh((current) =>
        current.distance ? {...current, distance: 0} : current,
      );
      return;
    }

    if (delta > 12) {
      event.preventDefault();
    }

    const distance = Math.min(86, Math.round(delta * 0.48));
    setPullRefresh((current) => ({...current, distance}));
  }, []);

  const handlePullRefreshEnd = useCallback(() => {
    if (!pullTrackingRef.current) {
      return;
    }

    pullTrackingRef.current = false;
    setPullRefresh((current) => {
      if (current.distance >= 58) {
        window.setTimeout(() => window.location.reload(), 180);
        return {distance: 68, refreshing: true};
      }

      return {distance: 0, refreshing: false};
    });
  }, []);
  const inactiveClients = useMemo(
    () =>
      clientProfiles
        .map((client) => {
          const completedCalendarDates = calendarEntries
            .filter(
              (entry) =>
                entry.client === client.name && isCalendarVisitCompleted(entry),
            )
            .map((entry) => toDisplayDate(entry.date));
          const lastVisit =
            getLatestDisplayDate(
              [
                ...visits
                  .filter(
                    (visit) =>
                      visit.client === client.name &&
                      visit.recordType !== "operation",
                  )
                  .map((visit) => visit.date),
                ...completedCalendarDates,
              ],
            ) || "";

          return {
            ...client,
            lastVisit,
            daysAbsent: getDaysSinceDisplayDate(lastVisit),
          };
        })
        .filter(
          (client) =>
            client.daysAbsent !== null && client.daysAbsent >= inactiveClientDays,
        )
        .sort(
          (firstClient, secondClient) =>
            (secondClient.daysAbsent ?? Number.MAX_SAFE_INTEGER) -
            (firstClient.daysAbsent ?? Number.MAX_SAFE_INTEGER),
        ),
    [calendarEntries, clientProfiles, inactiveClientDays, visits],
  );

  const todayCalendarAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled || !appSettings.todayVisitAlertsEnabled) {
      return [];
    }

    const today = getTodayInput();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const mode = appSettings.todayVisitAlertMode ?? "all";
    const upcomingMinutes = Math.max(15, Number(appSettings.upcomingVisitMinutes) || 180);

    return calendarEntries
      .filter((entry) => entry.date === today && entry.kind === "visit")
      .filter((entry) => !["completed", "cancelled", "no_show"].includes(entry.status))
      .filter((entry) => {
        const [hours, minutes] = String(entry.time ?? "00:00").split(":").map(Number);
        const difference = hours * 60 + minutes - currentMinutes;

        if (mode === "upcoming") return difference >= 0 && difference <= upcomingMinutes;
        return difference >= 0;
      })
      .map((entry) => ({
        ...entry,
        alertId: `calendar-${entry.id}`,
      }))
      .filter((entry) => !dismissedClientAlertIds.includes(entry.alertId))
      .sort((first, second) => String(first.time).localeCompare(String(second.time)));
  }, [
    appSettings.notificationsEnabled,
    appSettings.todayVisitAlertMode,
    appSettings.todayVisitAlertsEnabled,
    appSettings.upcomingVisitMinutes,
    calendarEntries,
    dismissedClientAlertIds,
  ]);

  const inactiveClientAlerts = useMemo(
    () =>
      appSettings.notificationsEnabled && appSettings.inactiveClientAlertsEnabled
        ? inactiveClients
            .map((client) => ({...client, alertId: `inactive-${client.id}`}))
            .filter((client) => !dismissedClientAlertIds.includes(client.alertId))
        : [],
    [
      appSettings.inactiveClientAlertsEnabled,
      appSettings.notificationsEnabled,
      dismissedClientAlertIds,
      inactiveClients,
    ],
  );

  const birthdayAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled || !appSettings.birthdayAlertsEnabled) {
      return [];
    }

    const reminderDays = Math.max(
      0,
      Number(appSettings.birthdayReminderDays) || defaultAppSettings.birthdayReminderDays,
    );

    return clientProfiles
      .map((client) => ({...client, birthdayInfo: getUpcomingBirthday(client.birthday)}))
      .filter((client) => client.birthdayInfo && client.birthdayInfo.daysLeft <= reminderDays)
      .map((client) => ({
        ...client,
        alertId: `birthday-${client.id}-${new Date().getFullYear()}`,
      }))
      .filter((client) => !dismissedClientAlertIds.includes(client.alertId))
      .sort((first, second) => first.birthdayInfo.daysLeft - second.birthdayInfo.daysLeft);
  }, [
    appSettings.birthdayAlertsEnabled,
    appSettings.birthdayReminderDays,
    appSettings.notificationsEnabled,
    clientProfiles,
    dismissedClientAlertIds,
  ]);

  const operationsAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled) {
      return [];
    }

    const today = getTodayInput();
    const taskAlerts = appSettings.taskAlertsEnabled
      ? tasks
      .filter((task) => task.status !== "completed" && task.dueDate && task.dueDate <= today)
      .map((task) => ({
        alertId: `task-${task.id}`,
        title: task.title,
        message: task.dueDate < today ? `Просрочено: ${task.dueDate}` : "Срок сегодня",
        page: "operations",
      }))
      : [];
    const supplyAlerts = appSettings.supplyAlertsEnabled
      ? supplies
      .filter((item) => Number(item.stock) <= Number(item.minStock))
      .map((item) => ({
        alertId: `supply-${item.id}`,
        title: item.name,
        message: `Остаток ${item.stock} ${item.unit} · минимум ${item.minStock}`,
        page: "operations",
      }))
      : [];

    return [...taskAlerts, ...supplyAlerts];
  }, [
    appSettings.notificationsEnabled,
    appSettings.supplyAlertsEnabled,
    appSettings.taskAlertsEnabled,
    supplies,
    tasks,
  ]);

  const packageBalanceAlerts = useMemo(
    () =>
      appSettings.notificationsEnabled
        ? clientPackages
            .filter((item) => Number(item.remainingVisits) <= 2)
            .map((item) => ({
              alertId: `package-balance-${item.id}-${item.remainingVisits}`,
              title: item.client,
              message:
                Number(item.remainingVisits) === 0
                  ? `${item.packageName}: сеансы закончились`
                  : `${item.packageName}: осталось ${item.remainingVisits}`,
            }))
            .filter((item) => !dismissedClientAlertIds.includes(item.alertId))
        : [],
    [
      appSettings.notificationsEnabled,
      clientPackages,
      dismissedClientAlertIds,
    ],
  );

  const revenueForecastAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled) return [];

    const today = getTodayInput();
    const tomorrowDate = new Date(`${today}T12:00:00`);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const forecast = (date) =>
      calendarEntries
        .filter(
          (entry) =>
            entry.kind === "visit" &&
            entry.date === date &&
            !["cancelled", "no_show"].includes(entry.status),
        )
        .reduce((sum, entry) => sum + toVisitNumber(entry.amount), 0);

    return [
      {alertId: `forecast-${today}`, title: "Прогноз на сегодня", message: `${forecast(today)} zł`},
      {alertId: `forecast-${tomorrow}`, title: "Прогноз на завтра", message: `${forecast(tomorrow)} zł`},
    ]
      .filter((item) => Number.parseFloat(item.message) > 0)
      .filter((item) => !dismissedClientAlertIds.includes(item.alertId));
  }, [
    appSettings.notificationsEnabled,
    calendarEntries,
    dismissedClientAlertIds,
  ]);

  const dismissAlertTemporarily = (alertId, delay = 6 * 60 * 60 * 1000) => {
    setDismissedClientAlertIds((current) =>
      current.includes(alertId) ? current : [...current, alertId],
    );
    window.setTimeout(() => {
      setDismissedClientAlertIds((current) =>
        current.filter((item) => item !== alertId),
      );
    }, delay);
  };

  const actionableNotificationInbox = useMemo(
    () => notificationInbox.filter((notification) => notification.undoAction),
    [notificationInbox],
  );

  const alertsCount =
    todayCalendarAlerts.length +
    birthdayAlerts.length +
    inactiveClientAlerts.length +
    actionableNotificationInbox.length +
    operationsAlerts.length +
    packageBalanceAlerts.length +
    revenueForecastAlerts.length;
  const serviceNames = useMemo(
    () => serviceCatalog.map((service) => service.name),
    [serviceCatalog],
  );
  const getCalendarServiceColor = useCallback(
    (entry) => {
      if (entry?.kind !== "visit") {
        return entry?.color || "#748091";
      }

      const service = serviceCatalog.find(
        (item) =>
          String(item.id) === String(entry.serviceId) ||
          item.name === entry.service ||
          String(entry.service ?? "").startsWith(item.name),
      );

      return service
        ? getServiceColor(service, serviceCatalog.indexOf(service))
        : entry.color || serviceColorPalette[0];
    },
    [serviceCatalog],
  );
  const calendarEntriesWithServiceColors = useMemo(
    () =>
      calendarEntries.map((entry) =>
        entry.kind === "visit"
          ? {...entry, color: getCalendarServiceColor(entry)}
          : entry,
      ),
    [calendarEntries, getCalendarServiceColor],
  );

  const packageSalesIncome = useMemo(
    () =>
      clientPackages.reduce(
        (sum, packageItem) => sum + (Number(packageItem.price) || 0),
        0,
      ),
    [clientPackages],
  );

  const paymentRows = useMemo(
    () => {
      const now = new Date();
      const calendarEntryById = new Map(
        calendarEntries
          .filter((entry) => entry.kind === "visit")
          .map((entry) => [entry.id, entry]),
      );
      const syncedCalendarEntryIds = new Set(
        visits.map((visit) => visit.calendarEntryId).filter(Boolean),
      );
      const normalizeCalendarEntryRow = (entry) => {
        const isPlanned = isCalendarVisitPlanned(entry, now);

        return {
          ...entry,
          id: `calendar-${entry.id}`,
          calendarEntryId: entry.id,
          date: toDisplayDate(entry.date),
          status: isPlanned ? entry.status : "completed",
          extra: toVisitNumber(entry.extra),
          tip: toVisitNumber(entry.tip),
          debt: toVisitNumber(entry.debt),
          commission: 0,
          commissionType: entry.commissionType || "Без комиссии",
          discount: toVisitNumber(entry.discount),
          isPlanned,
        };
      };
      const syncedVisits = visits.map((visit) => {
        const entry = calendarEntryById.get(visit.calendarEntryId);
        const hasValue = (value) =>
          value !== undefined && value !== null && String(value).trim() !== "";

        if (!entry) {
          return visit;
        }

        return {
          ...visit,
          date: toDisplayDate(entry.date),
          client: entry.client || visit.client,
          master: entry.master || visit.master,
          service: entry.service || visit.service,
          amount: hasValue(entry.amount)
            ? toVisitNumber(entry.amount)
            : toVisitNumber(visit.amount),
          payment: entry.payment || visit.payment || "Не указано",
          packageUsageId: entry.packageUsageId || visit.packageUsageId || "",
          packageName: entry.packageName || visit.packageName || "",
          packageSessionsUsed:
            toVisitNumber(entry.packageSessionsUsed) ||
            toVisitNumber(visit.packageSessionsUsed),
          tip: hasValue(entry.tip) ? toVisitNumber(entry.tip) : toVisitNumber(visit.tip),
          extra: hasValue(entry.extra)
            ? toVisitNumber(entry.extra)
            : toVisitNumber(visit.extra),
          debt: hasValue(entry.debt)
            ? toVisitNumber(entry.debt)
            : toVisitNumber(visit.debt),
          commissionType: entry.commissionType || visit.commissionType || "Без комиссии",
          discount: hasValue(entry.discount)
            ? toVisitNumber(entry.discount)
            : toVisitNumber(visit.discount),
          note: entry.note || visit.note || "",
          status: entry.status === "completed" ? "completed" : visit.status,
        };
      });

      return [
        ...calendarEntries
          .filter(
            (entry) =>
              entry.kind === "visit" &&
              !entry.visitId &&
              !syncedCalendarEntryIds.has(entry.id),
          )
          .map(normalizeCalendarEntryRow),
        ...syncedVisits,
      ];
    },
    [calendarEntries, visits],
  );

  const filteredPaymentRows = useMemo(
    () =>
      paymentRows.filter(
        (visit) =>
          (!paymentFilters.master || visit.master === paymentFilters.master) &&
          (!paymentFilters.payment || visit.payment === paymentFilters.payment) &&
          (!paymentFilters.client || visit.client === paymentFilters.client) &&
          (!paymentFilters.date || visit.date === toDisplayDate(paymentFilters.date)),
      ),
    [paymentFilters, paymentRows],
  );

  useEffect(() => {
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    const modalOpen =
      employeeModalOpen ||
      clientModalOpen ||
      serviceModalOpen ||
      packageModalOpen ||
      clientPackageModalOpen ||
      messageTemplateModalOpen ||
      calendarEntryModalOpen ||
      taskModalOpen ||
      supplyModalOpen ||
      financialOperationModalOpen;

    if (!modalOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [
    calendarEntryModalOpen,
    clientModalOpen,
    clientPackageModalOpen,
    employeeModalOpen,
    financialOperationModalOpen,
    messageTemplateModalOpen,
    packageModalOpen,
    serviceModalOpen,
    supplyModalOpen,
    taskModalOpen,
  ]);

  useEffect(() => {
    window.localStorage.setItem(
      EMPLOYEES_STORAGE_KEY,
      JSON.stringify(employees),
    );
  }, [employees]);
  useEffect(() => {
    window.localStorage.setItem(
      CLIENTS_STORAGE_KEY,
      JSON.stringify(clientProfiles),
    );
  }, [clientProfiles]);

  useEffect(() => {
    window.localStorage.setItem(
      SERVICES_STORAGE_KEY,
      JSON.stringify(serviceCatalog),
    );
  }, [serviceCatalog]);

  useEffect(() => {
    window.localStorage.setItem(
      PACKAGES_STORAGE_KEY,
      JSON.stringify(packagesCatalog),
    );
  }, [packagesCatalog]);

  useEffect(() => {
    window.localStorage.setItem(
      CLIENT_PACKAGES_STORAGE_KEY,
      JSON.stringify(clientPackages),
    );
  }, [clientPackages]);

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
    document.documentElement.style.setProperty(
      "--accent-color",
      appSettings.accentColor,
    );
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

  const cloudSnapshot = useMemo(
    () => ({
      version: 1,
      visits,
      employees,
      clients: clientProfiles,
      services: serviceCatalog,
      packages: packagesCatalog,
      clientPackages,
      messageTemplates,
      calendarEntries,
      dismissedClientAlertIds,
      communicationLog,
      notificationInbox,
      tasks,
      supplies,
      importDocuments,
      importedMailIds,
      autoCompletedCalendarEntryIds,
      settings: appSettings,
    }),
    [
      appSettings,
      calendarEntries,
      clientPackages,
      clientProfiles,
      communicationLog,
      dismissedClientAlertIds,
      employees,
      importDocuments,
      importedMailIds,
      autoCompletedCalendarEntryIds,
      messageTemplates,
      notificationInbox,
      packagesCatalog,
      serviceCatalog,
      supplies,
      tasks,
      visits,
    ],
  );

  useEffect(() => {
    cloudSnapshotRef.current = cloudSnapshot;
  }, [cloudSnapshot]);

  const applyCloudSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") return;

      if (Array.isArray(snapshot.visits)) setVisits(snapshot.visits);
      if (Array.isArray(snapshot.employees)) setEmployees(snapshot.employees);
      if (Array.isArray(snapshot.clients)) {
        setClientProfiles(applyBooksySources(snapshot.clients, snapshot.visits ?? []));
      }
      if (Array.isArray(snapshot.services)) {
        setServiceCatalog(normalizeServiceColors(snapshot.services));
      }
      if (Array.isArray(snapshot.packages)) setPackagesCatalog(snapshot.packages);
      if (Array.isArray(snapshot.clientPackages)) setClientPackages(snapshot.clientPackages);
      if (Array.isArray(snapshot.messageTemplates)) setMessageTemplates(snapshot.messageTemplates);
      if (Array.isArray(snapshot.calendarEntries)) setCalendarEntries(snapshot.calendarEntries);
      if (Array.isArray(snapshot.dismissedClientAlertIds)) {
        setDismissedClientAlertIds(snapshot.dismissedClientAlertIds);
      }
      if (Array.isArray(snapshot.communicationLog)) setCommunicationLog(snapshot.communicationLog);
      if (Array.isArray(snapshot.notificationInbox)) {
        setNotificationInbox(snapshot.notificationInbox.filter((item) => item.undoAction));
      }
      if (Array.isArray(snapshot.tasks)) setTasks(snapshot.tasks);
      if (Array.isArray(snapshot.supplies)) setSupplies(snapshot.supplies);
      if (Array.isArray(snapshot.importDocuments)) setImportDocuments(snapshot.importDocuments);
      if (Array.isArray(snapshot.importedMailIds)) setImportedMailIds(snapshot.importedMailIds);
      if (Array.isArray(snapshot.autoCompletedCalendarEntryIds)) {
        setAutoCompletedCalendarEntryIds(snapshot.autoCompletedCalendarEntryIds);
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
    },
    [setAppSettings],
  );

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    supabase.auth.getSession().then(({data}) => {
      if (!active) return;
      setAuthSession(data.session);
      setAuthReady(true);
    });
    const {data} = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (!session) {
        setCloudHydrated(false);
        setCloudLoadError("");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!supabase || !userId) return undefined;

    let active = true;

    const hydrate = async () => {
      const {data, error} = await supabase
        .from("crm_snapshots")
        .select("payload")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setCloudLoadError(error.message);
        return;
      }

      if (data?.payload && Object.keys(data.payload).length > 0) {
        applyCloudSnapshot(data.payload);
      } else {
        const {error: saveError} = await supabase
          .from("crm_snapshots")
          .upsert({user_id: userId, payload: cloudSnapshotRef.current});

        if (saveError) {
          setCloudLoadError(saveError.message);
          return;
        }
      }

      setCloudHydrated(true);
      setCloudLoadError("");
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [applyCloudSnapshot, authSession?.user?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!supabase || !userId || !cloudHydrated) return undefined;

    const timer = window.setTimeout(async () => {
      await supabase
        .from("crm_snapshots")
        .upsert({
          user_id: userId,
          payload: cloudSnapshotRef.current,
          updated_at: new Date().toISOString(),
        });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [authSession?.user?.id, cloudHydrated, cloudSnapshot]);

  const employeeStats = useMemo(
    () =>
      employees.map((employee) => {
        const employeeVisits = visits.filter(
          (visit) => visit.recordType !== "operation" && visit.master === employee.name,
        );
        const income = employeeVisits.reduce(
          (sum, visit) => sum + getEmployeePayout(visit, employees),
          0,
        );
        const tips = employeeVisits.reduce((sum, visit) => sum + visit.tip, 0);
        const averageCheck = Math.round(
          income / Math.max(employeeVisits.length, 1),
        );

        return {
          ...employee,
          visitsCount: employeeVisits.length,
        income,
          tips,
          averageCheck,
        };
      }),
    [employees, visits],
  );

  const archiveNotification = useCallback((notification) => {
    if (!notification?.undoAction || notification.persist === false) {
      return;
    }

    setNotificationInbox((current) => [
      {
        ...notification,
        archivedAt: new Date().toISOString(),
      },
      ...current.filter((item) => item.id !== notification.id),
    ].slice(0, 60));
  }, []);

  const showNextNotification = useCallback(() => {
    if (notificationTimerRef.current || notificationVisibleRef.current) {
      return;
    }

    const [nextNotification, ...nextQueue] = notificationQueueRef.current;

    if (!nextNotification) {
      return;
    }

    notificationQueueRef.current = nextQueue;
    notificationVisibleRef.current = true;
    setNotifications([nextNotification]);
  }, []);

  const pushNotification = useCallback(
    (notification) => {
      const id = createLocalId();
      const nextNotification = {id, ...notification};

      notificationQueueRef.current = [
        ...notificationQueueRef.current,
        nextNotification,
      ];
      showNextNotification();
    },
    [showNextNotification],
  );

  const closeNotification = useCallback((id) => {
    archiveNotification(notifications.find((item) => item.id === id));
    setNotifications((current) => current.filter((item) => item.id !== id));

    if (notificationTimerRef.current) {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }

    notificationVisibleRef.current = false;
  }, [archiveNotification, notifications]);

  useEffect(
    () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }

      if (notifications.length === 0) {
        notificationVisibleRef.current = false;
        notificationTimerRef.current = window.setTimeout(() => {
          notificationTimerRef.current = null;
          showNextNotification();
        }, 260);

        return () => {
          if (notificationTimerRef.current) {
            window.clearTimeout(notificationTimerRef.current);
            notificationTimerRef.current = null;
          }
        };
      }

      notificationVisibleRef.current = true;
      notificationTimerRef.current = window.setTimeout(() => {
        archiveNotification(notifications[0]);
        setNotifications([]);
      }, 4200);

      return () => {
        if (notificationTimerRef.current) {
          window.clearTimeout(notificationTimerRef.current);
          notificationTimerRef.current = null;
        }
      };
    },
    [archiveNotification, notifications, showNextNotification],
  );

  useEffect(
    () => () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !appSettings.notificationsEnabled ||
      !appSettings.todayVisitAlertsEnabled ||
      !appSettings.smartVisitPopupsEnabled
    ) {
      return undefined;
    }

    const checkUpcomingVisits = () => {
      const today = getTodayInput();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      calendarEntries
        .filter((entry) => entry.date === today && entry.kind === "visit")
        .filter((entry) => !["completed", "cancelled", "no_show"].includes(entry.status))
        .forEach((entry) => {
          const [hours, minutes] = String(entry.time ?? "00:00").split(":").map(Number);
          const difference = hours * 60 + minutes - currentMinutes;

          if (
            difference < 0 ||
            difference > (Number(appSettings.smartVisitPopupMinutes) || 15) ||
            smartVisitAlertIds.current.has(entry.id)
          ) {
            return;
          }

          smartVisitAlertIds.current.add(entry.id);
          pushNotification({
            title: difference === 0 ? "Визит начинается сейчас" : `Визит через ${difference} мин.`,
            message: `${entry.client} · ${entry.service} · ${entry.master}`,
          });
        });
    };

    checkUpcomingVisits();
    const timer = window.setInterval(checkUpcomingVisits, 60000);

    return () => window.clearInterval(timer);
  }, [
    appSettings.notificationsEnabled,
    appSettings.smartVisitPopupMinutes,
    appSettings.smartVisitPopupsEnabled,
    appSettings.todayVisitAlertsEnabled,
    calendarEntries,
    pushNotification,
  ]);

  const openCreateEmployee = () => {
    setEditingEmployee(null);
    setEmployeeModalOpen(true);
  };

  const handleFinancialOperationSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const extra = toVisitNumber(form.get("extra"));
    const operationType = String(form.get("operationType") ?? "Доплата");

    if (extra <= 0) return;

    setVisits((current) => [
      {
        id: createLocalId(),
        recordType: "operation",
        date: toDisplayDate(form.get("date")),
        client: String(form.get("client") ?? "").trim(),
        master: "",
        service: operationType,
        duration: "",
        amount: 0,
        payment: String(form.get("payment") ?? "Не указано"),
        packageUsageId: "",
        packageName: "",
        packageSessionsUsed: 0,
        tip: 0,
        commission: 0,
        commissionType: "Без комиссии",
        extra,
        debt: 0,
        discount: 0,
        note: String(form.get("note") ?? "").trim(),
      },
      ...current,
    ]);
    setFinancialOperationModalOpen(false);
    pushNotification({
      title: "Поступление добавлено",
      message: `${operationType}: ${extra} zł`,
    });
  };

  const deletePaymentRow = (visit) => {
    setPendingPaymentDelete(visit);
    setOpenPaymentActionMenuId(null);
  };

  const confirmPaymentDelete = () => {
    if (!pendingPaymentDelete) {
      return;
    }

    if (pendingPaymentDelete.calendarEntryId) {
      const completedVisit = visits.find(
        (item) => item.calendarEntryId === pendingPaymentDelete.calendarEntryId,
      );

      setCalendarEntries((current) =>
        current.filter((entry) => entry.id !== pendingPaymentDelete.calendarEntryId),
      );
      setVisits((current) =>
        current.filter(
          (item) =>
            item.id !== pendingPaymentDelete.id &&
            item.calendarEntryId !== pendingPaymentDelete.calendarEntryId,
        ),
      );
      if (completedVisit) {
        updatePackageBalance(completedVisit, null);
      }
      pushNotification({
        title: "Запись удалена",
        message: `${pendingPaymentDelete.client}: ${pendingPaymentDelete.service}`,
      });
      setPendingPaymentDelete(null);
      return;
    }

    updatePackageBalance(pendingPaymentDelete, null);
    setVisits((current) => current.filter((item) => item.id !== pendingPaymentDelete.id));
    pushNotification({
      title:
        pendingPaymentDelete.recordType === "operation"
          ? "Поступление удалено"
          : "Запись удалена",
      message: `${
        pendingPaymentDelete.service || "Финансовая запись"
      } убрана из журнала`,
    });
    setPendingPaymentDelete(null);
  };

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const previousName = editingEmployee?.name;

    if (!name) {
      return;
    }

    const employee = {
      id: editingEmployee?.id ?? createLocalId(),
      name,
      role: String(form.get("role") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      commissionRate: Number(form.get("commissionRate")) || 0,
      shiftStart: form.get("shiftStart") || "08:00",
      shiftEnd: form.get("shiftEnd") || "22:00",
      status: form.get("status"),
    };

    setEmployees((current) =>
      editingEmployee
        ? current.map((item) => (item.id === employee.id ? employee : item))
        : [employee, ...current],
    );

    if (previousName && previousName !== employee.name) {
      setVisits((current) =>
        current.map((visit) =>
          visit.master === previousName
            ? {...visit, master: employee.name}
            : visit,
        ),
      );
      setCalendarEntries((current) =>
        current.map((entry) =>
          entry.master === previousName
            ? {...entry, master: employee.name}
            : entry,
        ),
      );
    }

    setEmployeeModalOpen(false);
    setEditingEmployee(null);
    pushNotification({
      title: editingEmployee ? "Сотрудник обновлен" : "Сотрудник добавлен",
      message: `${employee.name} сохранен в базе сотрудников`,
    });
  };

  const deleteEmployee = (employee) => {
    setEmployees((current) =>
      current.filter((item) => item.id !== employee.id),
    );
    pushNotification({
      title: "Сотрудник удален",
      message: `${employee.name} удален из базы сотрудников`,
    });
  };

  const openCreateClient = (prefill = {}) => {
    setEditingClient(
      prefill?.name
        ? {
            name: prefill.name,
            source: "Instagram",
            preference: "Любой мастер",
            status: "Новый",
          }
        : null,
    );
    setClientModalOpen(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const handleClientSubmit = (eventOrForm) => {
    eventOrForm.preventDefault?.();
    const formElement = eventOrForm.currentTarget ?? eventOrForm;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const previousName = editingClient?.name;

    if (!name) {
      return;
    }

    const client = {
      id: editingClient?.id ?? createLocalId(),
      name,
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      birthday: String(form.get("birthday") ?? "").trim(),
      instagram: String(form.get("instagram") ?? "").trim(),
      telegram: String(form.get("telegram") ?? "").trim(),
      source: form.get("source"),
      preference: form.get("preference"),
      status: form.get("status") || "Активный",
      tags: String(form.get("tags") ?? "").trim(),
      note: String(form.get("note") ?? "").trim(),
    };

    setClientProfiles((current) =>
      editingClient
        ? current.map((item) => (item.id === client.id ? client : item))
        : [client, ...current],
    );

    if (previousName && previousName !== client.name) {
      setVisits((current) =>
        current.map((visit) =>
          visit.client === previousName ? {...visit, client: client.name} : visit,
        ),
      );
      setClientPackages((current) =>
        current.map((packageItem) =>
          packageItem.client === previousName
            ? {...packageItem, client: client.name}
            : packageItem,
        ),
      );
      setCalendarEntries((current) =>
        current.map((entry) =>
          entry.kind === "visit" && entry.client === previousName
            ? {...entry, client: client.name}
            : entry,
        ),
      );
    }

    setClientModalOpen(false);
    setEditingClient(null);
    pushNotification({
      title: editingClient ? "Клиент обновлен" : "Клиент добавлен",
      message: `${client.name} сохранен в базе клиентов`,
    });
  };

  const deleteClient = (client) => {
    setClientProfiles((current) => current.filter((item) => item.id !== client.id));
    setClientPackages((current) =>
      current.filter((packageItem) => packageItem.client !== client.name),
    );
    pushNotification({
      title: "Клиент удален",
      message: `${client.name} удален из базы клиентов`,
    });
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceModalOpen(true);
  };

  const openEditService = (service) => {
    setEditingService(service);
    setServiceModalOpen(true);
  };

  const handleServiceSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const previousName = editingService?.name;

    if (!name) {
      return;
    }

    const service = {
      id: editingService?.id ?? createLocalId(),
      name,
      category: String(form.get("category") ?? "").trim() || "Массаж",
      color: form.get("color") || editingService?.color || getRandomServiceColor(),
      variants: [60, 75, 90, 120]
        .map((duration) => ({
          duration,
          price: Number(form.get(`price_${duration}`)) || 0,
        }))
        .filter((variant) => variant.price > 0),
    };

    setServiceCatalog((current) =>
      editingService
        ? current.map((item) => (item.id === service.id ? service : item))
        : [service, ...current],
    );
    setCalendarEntries((current) =>
      current.map((entry) =>
        entry.serviceId === service.id
          ? {...entry, service: service.name, color: service.color}
          : entry,
      ),
    );

    if (previousName && previousName !== service.name) {
      setVisits((current) =>
        current.map((visit) =>
          visit.service === previousName
            ? {...visit, service: service.name}
            : visit,
        ),
      );
      setPackagesCatalog((current) =>
        current.map((packageItem) =>
          packageItem.service === previousName
            ? {...packageItem, service: service.name}
            : packageItem,
        ),
      );
      setClientPackages((current) =>
        current.map((packageItem) =>
          packageItem.service === previousName
            ? {...packageItem, service: service.name}
            : packageItem,
        ),
      );
    }

    setServiceModalOpen(false);
    setEditingService(null);
    pushNotification({
      title: editingService ? "Услуга обновлена" : "Услуга добавлена",
      message: `${service.name} сохранена в базе услуг`,
    });
  };

  const deleteService = (service) => {
    setServiceCatalog((current) =>
      current.filter((item) => item.id !== service.id),
    );
    pushNotification({
      title: "Услуга удалена",
      message: `${service.name} удалена из базы услуг`,
    });
  };

  const openCreatePackage = () => {
    setEditingPackage(null);
    setPackageModalOpen(true);
  };

  const openEditPackage = (packageItem) => {
    setEditingPackage(packageItem);
    setPackageModalOpen(true);
  };

  const handlePackageSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();

    if (!name) {
      return;
    }

    const packageItem = {
      id: editingPackage?.id ?? createLocalId(),
      name,
      service: form.get("service"),
      visitsCount: Number(form.get("visitsCount")) || 0,
      price: Number(form.get("price")) || 0,
      validityDays: Number(form.get("validityDays")) || 0,
      status: form.get("status"),
    };

    setPackagesCatalog((current) =>
      editingPackage
        ? current.map((item) =>
            item.id === packageItem.id ? packageItem : item,
          )
        : [packageItem, ...current],
    );
    setPackageModalOpen(false);
    setEditingPackage(null);
    pushNotification({
      title: editingPackage ? "Пакет обновлен" : "Пакет добавлен",
      message: `${packageItem.name} сохранен в базе пакетов`,
    });
  };

  const deletePackage = (packageItem) => {
    setPackagesCatalog((current) =>
      current.filter((item) => item.id !== packageItem.id),
    );
    pushNotification({
      title: "Пакет удален",
      message: `${packageItem.name} удален из базы пакетов`,
      undoAction: {
        type: "restore-package-template",
        payload: packageItem,
      },
    });
  };

  const openCreateMessageTemplate = () => {
    setEditingMessageTemplate(null);
    setMessageTemplateModalOpen(true);
  };

  const openEditMessageTemplate = (template) => {
    setEditingMessageTemplate(template);
    setMessageTemplateModalOpen(true);
  };

  const handleMessageTemplateSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();

    if (!name || !body) {
      return;
    }

    const template = {
      id: editingMessageTemplate?.id ?? createLocalId(),
      name,
      channel: form.get("channel"),
      language: form.get("language"),
      audience: form.get("audience"),
      subject: String(form.get("subject") ?? "").trim(),
      body,
    };

    setMessageTemplates((current) =>
      editingMessageTemplate
        ? current.map((item) => (item.id === template.id ? template : item))
        : [template, ...current],
    );
    setMessageTemplateModalOpen(false);
    setEditingMessageTemplate(null);
    pushNotification({
      title: editingMessageTemplate ? "Шаблон обновлен" : "Шаблон добавлен",
      message: `${template.name} сохранен в шаблонах сообщений`,
    });
  };

  const deleteMessageTemplate = (template) => {
    setMessageTemplates((current) =>
      current.filter((item) => item.id !== template.id),
    );
    pushNotification({
      title: "Шаблон удален",
      message: `${template.name} удален из шаблонов сообщений`,
    });
  };

  const openCreateClientPackage = () => {
    setEditingClientPackage(null);
    setClientPackageModalOpen(true);
  };

  const openEditClientPackage = (packageItem) => {
    setEditingClientPackage(packageItem);
    setClientPackageModalOpen(true);
  };

  const handleClientPackageSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const packageTemplateId = Number(form.get("packageTemplateId"));
    const packageTemplate = packagesCatalog.find(
      (packageItem) => packageItem.id === packageTemplateId,
    );

    if (!packageTemplate && !editingClientPackage) {
      return;
    }

    const totalVisits =
      Number(form.get("totalVisits")) ||
      packageTemplate?.visitsCount ||
      editingClientPackage?.totalVisits ||
      0;
    const remainingVisits = Number(form.get("remainingVisits")) || 0;
    const clientPackage = {
      id: editingClientPackage?.id ?? createLocalId(),
      client: form.get("client"),
      packageId: packageTemplate?.id ?? editingClientPackage?.packageId,
      packageName:
        packageTemplate?.name ?? editingClientPackage?.packageName ?? "",
      service: packageTemplate?.service ?? editingClientPackage?.service ?? "",
      master: form.get("master") || editingClientPackage?.master || "",
      totalVisits,
      remainingVisits: Math.min(remainingVisits, totalVisits),
      price: Number(form.get("price")) || packageTemplate?.price || 0,
      purchaseDate: toDisplayDate(form.get("purchaseDate")),
      payment: form.get("payment"),
      status: form.get("status"),
    };

    setClientPackages((current) =>
      editingClientPackage
        ? current.map((item) =>
            item.id === clientPackage.id ? clientPackage : item,
          )
        : [clientPackage, ...current],
    );
    setClientPackageModalOpen(false);
    setEditingClientPackage(null);
    pushNotification({
      title: editingClientPackage ? "Остаток обновлен" : "Пакет продан",
      message: `${clientPackage.client}: использовано ${getPackageProgressLabel(clientPackage)}`,
    });
  };

  const deleteClientPackage = (packageItem) => {
    setClientPackages((current) =>
      current.filter((item) => item.id !== packageItem.id),
    );
    pushNotification({
      title: "Пакет клиента удален",
      message: `${packageItem.client}: ${packageItem.packageName}`,
      undoAction: {
        type: "restore-client-package",
        payload: packageItem,
      },
    });
  };

  const undoNotificationAction = (notification) => {
    if (notification.undoAction?.type === "restore-client-package") {
      const packageItem = notification.undoAction.payload;

      setClientPackages((current) =>
        current.some((item) => item.id === packageItem.id)
          ? current
          : [packageItem, ...current],
      );
      setNotificationInbox((current) =>
        current.filter((item) => item.id !== notification.id),
      );
      pushNotification({
        title: "Пакет восстановлен",
        message: `${packageItem.client}: ${packageItem.packageName}`,
        persist: false,
      });
    } else if (notification.undoAction?.type === "restore-package-template") {
      const packageItem = notification.undoAction.payload;

      setPackagesCatalog((current) =>
        current.some((item) => item.id === packageItem.id)
          ? current
          : [packageItem, ...current],
      );
      setNotificationInbox((current) =>
        current.filter((item) => item.id !== notification.id),
      );
      pushNotification({
        title: "Шаблон пакета восстановлен",
        message: packageItem.name,
        persist: false,
      });
    }
  };

  const updatePackageBalance = (previousVisit, nextVisit) => {
    setClientPackages((current) => {
      const restorePrevious = current.map((packageItem) => {
        if (packageItem.id !== previousVisit?.packageUsageId) {
          return packageItem;
        }

        const restored =
          packageItem.remainingVisits +
          (Number(previousVisit.packageSessionsUsed) || 0);

        return {
          ...packageItem,
          remainingVisits: Math.min(restored, packageItem.totalVisits),
          status:
            Math.min(restored, packageItem.totalVisits) > 0
              ? packageItem.status === "Закончился"
                ? "Активен"
                : packageItem.status
              : "Закончился",
        };
      });

      return restorePrevious.map((packageItem) => {
        if (packageItem.id !== nextVisit?.packageUsageId) {
          return packageItem;
        }

        const used = Number(nextVisit.packageSessionsUsed) || 0;

        return {
          ...packageItem,
          remainingVisits: Math.max(0, packageItem.remainingVisits - used),
          status:
            Math.max(0, packageItem.remainingVisits - used) === 0
              ? "Закончился"
              : packageItem.status,
        };
      });
    });
  };

  const openCreateCalendarEntry = (defaults = {}) => {
    setEditingCalendarEntry(null);
    setCalendarEntryDefaults(defaults);
    setCalendarEntryModalOpen(true);
  };

  const repeatClientVisit = (client, appointment) => {
    const repeatedService = serviceCatalog.find(
      (service) =>
        String(service.id) === String(appointment.repeatDefaults.serviceId) ||
        service.name === appointment.repeatDefaults.service,
    );

    setActivePage("calendar");
    openCreateCalendarEntry({
      amount: appointment.repeatDefaults.amount,
      client: client.name,
      date: getTodayInput(),
      duration: appointment.repeatDefaults.duration,
      kind: "visit",
      master: appointment.repeatDefaults.master,
      payment: appointment.repeatDefaults.payment,
      serviceId: repeatedService?.id ?? "",
      time: "10:00",
    });
  };

  const addClientCalendarVisit = (client) => {
    setActivePage("calendar");
    openCreateCalendarEntry({
      client: client.name,
      date: getTodayInput(),
      kind: "visit",
      time: "10:00",
    });
  };

  const addCalendarFormClient = (name) => {
    const trimmedName = String(name ?? "").trim();

    if (!trimmedName) {
      return;
    }

    const exists = clientProfiles.some(
      (client) => client.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (exists) {
      return;
    }

    setClientProfiles((current) => [
      {
        id: createLocalId(),
        name: trimmedName,
        phone: "",
        email: "",
        birthday: "",
        instagram: "",
        telegram: "",
        source: "Визит",
        preference: "Любой мастер",
        status: "Новый",
        tags: "",
        note: "",
      },
      ...current,
    ]);
    pushNotification({
      title: "Клиент добавлен",
      message: `${trimmedName} теперь в базе клиентов`,
    });
  };

  const openEditCalendarEntry = (entry) => {
    setEditingCalendarEntry(entry);
    setCalendarEntryDefaults({});
    setCalendarEntryModalOpen(true);
  };

  const getCalendarConflicts = (entry, ignoredId = null) => {
    const entryStart = Number(String(entry.time).split(":")[0]) * 60 +
      Number(String(entry.time).split(":")[1]);
    const entryEnd = entryStart + Number(entry.duration);

    return calendarEntries.filter((item) => {
      if (
        item.id === ignoredId ||
        ["completed", "cancelled", "no_show"].includes(item.status)
      ) {
        return false;
      }

      const itemStart = Number(String(item.time).split(":")[0]) * 60 +
        Number(String(item.time).split(":")[1]);
      const itemEnd = itemStart + Number(item.duration);

      return (
        item.date === entry.date &&
        item.master === entry.master &&
        entryStart < itemEnd &&
        itemStart < entryEnd
      );
    });
  };

  const getCalendarShiftWarning = (entry) => {
    const employee = employees.find((item) => item.name === entry.master);

    if (!employee) {
      return "";
    }

    const toMinutes = (time) => {
      const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);
      return hours * 60 + minutes;
    };
    const entryStart = toMinutes(entry.time);
    const entryEnd = entryStart + Number(entry.duration);
    const shiftStart = toMinutes(employee.shiftStart || appSettings.workdayStart);
    const shiftEnd = toMinutes(employee.shiftEnd || appSettings.workdayEnd);

    return entryStart < shiftStart || entryEnd > shiftEnd
      ? `Запись выходит за смену ${employee.name}: ${employee.shiftStart || appSettings.workdayStart}–${employee.shiftEnd || appSettings.workdayEnd}.`
      : "";
  };

  const syncCompletedCalendarVisit = (entry) => {
    if (entry.kind !== "visit" || !entry.visitId) {
      return;
    }

    setVisits((current) =>
      current.map((visit) =>
        visit.id === entry.visitId || visit.calendarEntryId === entry.id
          ? {
              ...visit,
              date: toDisplayDate(entry.date),
              client: entry.client,
              master: entry.master,
              service: entry.service,
              amount: toVisitNumber(entry.amount),
              payment: entry.payment || "Не указано",
              packageUsageId: entry.packageUsageId || "",
              packageName: entry.packageName || "",
              packageSessionsUsed: entry.packageSessionsUsed || 0,
              tip: toVisitNumber(entry.tip),
              commissionType: entry.commissionType || "Без комиссии",
              extra: toVisitNumber(entry.extra),
              debt: toVisitNumber(entry.debt),
              discount: toVisitNumber(entry.discount),
              note: entry.note || "",
            }
          : visit,
      ),
    );
  };

  const shouldReopenCompletedCalendarEntry = (entry, previousEntry = entry) =>
    previousEntry?.status === "completed" &&
    entry.kind === "visit" &&
    isCalendarVisitPlanned(
      {...entry, status: "scheduled", completedAt: "", visitId: ""},
      new Date(),
    );

  const normalizeCalendarEntryTiming = (entry, previousEntry = entry) =>
    shouldReopenCompletedCalendarEntry(entry, previousEntry)
      ? {...entry, status: "scheduled", completedAt: "", visitId: ""}
      : entry;

  const removeCompletedVisitLink = (previousEntry, nextEntry) => {
    if (!shouldReopenCompletedCalendarEntry(nextEntry, previousEntry)) {
      return;
    }

    const completedVisit = visits.find(
      (visit) =>
        visit.id === previousEntry?.visitId ||
        visit.calendarEntryId === previousEntry?.id,
    );

    if (completedVisit) {
      updatePackageBalance(completedVisit, null);
      setVisits((current) =>
        current.filter(
          (visit) =>
            visit.id !== completedVisit.id &&
            visit.calendarEntryId !== previousEntry?.id,
        ),
      );
    }
  };

  const saveCalendarEntry = (entry, isEditing) => {
    const previousEntry = isEditing
      ? calendarEntries.find((item) => item.id === entry.id)
      : null;
    removeCompletedVisitLink(previousEntry, entry);
    setCalendarEntries((current) =>
      isEditing
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [...current, entry],
    );
    syncCompletedCalendarVisit(entry);
    setCalendarEntryModalOpen(false);
    setEditingCalendarEntry(null);
    setCalendarEntryDefaults({});
    pushNotification({
      title: isEditing ? "Календарь обновлен" : "Добавлено в календарь",
      message: entry.kind === "visit" ? `${entry.client} · ${entry.time}` : entry.title,
    });
  };

  const handleCalendarEntrySubmit = (eventOrForm) => {
    eventOrForm.preventDefault?.();
    const formElement = eventOrForm.currentTarget ?? eventOrForm;
    const form = new FormData(formElement);
    const kind = form.get("kind");
    const service = serviceCatalog.find(
      (item) => String(item.id) === String(form.get("serviceId")),
    );
    const packageUsageId = Number(form.get("packageUsageId")) || "";
    const startTime = String(form.get("time") ?? "00:00");
    const endTime = String(form.get("endTime") ?? "00:00");
    const toCalendarMinutes = (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };
    const duration =
      kind === "visit"
        ? Number(form.get("duration")) || 60
        : Math.max(15, toCalendarMinutes(endTime) - toCalendarMinutes(startTime));
    const serviceVariant = service?.variants?.find(
      (variant) => Number(variant.duration) === duration,
    );
    const rawAmount = String(form.get("amount") ?? "").trim();
    const entryDraft = {
      id: editingCalendarEntry?.id ?? createLocalId(),
      status: editingCalendarEntry?.status ?? "scheduled",
      completedAt: editingCalendarEntry?.completedAt ?? "",
      visitId: editingCalendarEntry?.visitId ?? "",
      kind,
      date: form.get("date"),
      time: startTime,
      duration,
      master: form.get("master"),
      title: kind === "visit" ? "" : String(form.get("title") ?? "").trim(),
      client: kind === "visit" ? form.get("client") : "",
      serviceId: kind === "visit" ? Number(form.get("serviceId")) : "",
      service: kind === "visit" ? service?.name ?? "" : "",
      amount:
        kind === "visit"
          ? rawAmount === ""
            ? toVisitNumber(serviceVariant?.price)
            : toVisitNumber(rawAmount)
          : 0,
      payment: kind === "visit" ? form.get("payment") : "",
      packageUsageId,
      packageName:
        clientPackages.find((item) => item.id === packageUsageId)?.packageName ?? "",
      packageSessionsUsed: packageUsageId ? 1 : 0,
      tip: kind === "visit" ? toVisitNumber(form.get("tip")) : 0,
      extra: kind === "visit" ? toVisitNumber(form.get("extra")) : 0,
      debt: kind === "visit" ? toVisitNumber(form.get("debt")) : 0,
      discount: kind === "visit" ? toVisitNumber(form.get("discount")) : 0,
      commissionType:
        kind === "visit" ? String(form.get("commissionType") ?? "Без комиссии") : "Без комиссии",
      color:
        kind === "visit"
          ? getCalendarServiceColor({
              kind,
              serviceId: form.get("serviceId"),
              service: service?.name,
              color: form.get("color"),
            })
          : form.get("color") || "#748091",
      note: String(form.get("note") ?? "").trim(),
    };
    const entry = normalizeCalendarEntryTiming(entryDraft, editingCalendarEntry);

    const isEditing = Boolean(editingCalendarEntry);
    const conflicts = getCalendarConflicts(entry, editingCalendarEntry?.id);
    const shiftWarning = getCalendarShiftWarning(entry);

    if (appSettings.calendarConflictWarnings && (conflicts.length > 0 || shiftWarning)) {
      setPendingCalendarConflict({entry, isEditing, conflicts, shiftWarning, type: "save"});
      return;
    }

    saveCalendarEntry(entry, isEditing);
  };

  const deleteCalendarEntry = (entry) => {
    setCalendarEntries((current) => current.filter((item) => item.id !== entry.id));
    pushNotification({
      title: entry.kind === "visit" ? "Запись отменена" : "Резерв удален",
      message: entry.kind === "visit" ? entry.client : entry.title,
    });
  };

  const moveCalendarEntry = (entryId, nextPosition) => {
    const currentEntry = calendarEntries.find((entry) => entry.id === entryId);
    const movedEntry = currentEntry
      ? normalizeCalendarEntryTiming({...currentEntry, ...nextPosition}, currentEntry)
      : null;
    const conflicts = movedEntry ? getCalendarConflicts(movedEntry, entryId) : [];
    const shiftWarning = movedEntry ? getCalendarShiftWarning(movedEntry) : "";

    if (!movedEntry) {
      return;
    }

    if (appSettings.calendarConflictWarnings && (conflicts.length > 0 || shiftWarning)) {
      setPendingCalendarConflict({
        entry: movedEntry,
        isEditing: true,
        conflicts,
        shiftWarning,
        type: "move",
      });
      return;
    }

    setCalendarEntries((current) =>
      current.map((entry) => (entry.id === entryId ? movedEntry : entry)),
    );
    removeCompletedVisitLink(currentEntry, movedEntry);
    syncCompletedCalendarVisit(movedEntry);
  };

  const confirmCalendarConflict = () => {
    if (!pendingCalendarConflict) {
      return;
    }

    const {entry, isEditing, type} = pendingCalendarConflict;

    if (type === "move") {
      const previousEntry = calendarEntries.find((item) => item.id === entry.id);
      removeCompletedVisitLink(previousEntry, entry);
      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? entry : item)),
      );
      syncCompletedCalendarVisit(entry);
    } else {
      saveCalendarEntry(entry, isEditing);
    }

    setPendingCalendarConflict(null);
  };

  const completeCalendarVisit = (entry, {notify = true} = {}) => {
    if (["completed", "cancelled", "no_show"].includes(entry.status)) {
      return;
    }

    const matchedService = serviceCatalog.find(
      (service) => String(service.id) === String(entry.serviceId),
    );
    const matchedVariant = matchedService?.variants?.find(
      (variant) => Number(variant.duration) === Number(entry.duration),
    );
    const amount =
      entry.amount === "" || entry.amount === null || entry.amount === undefined
        ? toVisitNumber(matchedVariant?.price)
        : toVisitNumber(entry.amount);
    const visit = {
      id: createLocalId(),
      calendarEntryId: entry.id,
      date: toDisplayDate(entry.date),
      client: entry.client,
      master: entry.master,
      service: entry.service,
      duration: "",
      amount,
      payment: entry.payment || "Не указано",
      packageUsageId: entry.packageUsageId || "",
      packageName: entry.packageName || "",
      packageSessionsUsed: entry.packageSessionsUsed || 0,
      tip: toVisitNumber(entry.tip),
      commission: 0,
      commissionType: entry.commissionType || "Без комиссии",
      extra: toVisitNumber(entry.extra),
      debt: toVisitNumber(entry.debt),
      discount: toVisitNumber(entry.discount),
      note: entry.note || "",
    };

    const existingVisit = visits.find((item) => item.calendarEntryId === entry.id);
    const hasExistingVisit = Boolean(existingVisit);

    if (!hasExistingVisit) {
      setVisits((current) =>
        current.some((item) => item.calendarEntryId === entry.id)
          ? current
          : [visit, ...current],
      );
      updatePackageBalance(null, visit);
    }

    setCalendarEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              status: "completed",
              completedAt: new Date().toISOString(),
              visitId: existingVisit?.id ?? visit.id,
            }
          : item,
      ),
    );

    if (notify && !hasExistingVisit) {
      pushNotification({
        title: "Визит завершен",
        message: `${entry.client} добавлен в журнал визитов`,
      });
    }
  };

  useEffect(() => {
    const now = new Date();
    const expiredEntries = calendarEntries.filter((entry) => {
      if (
        entry.kind !== "visit" ||
        entry.visitId ||
        ["completed", "cancelled", "no_show"].includes(entry.status) ||
        autoCompletedCalendarEntryIdsRef.current.has(entry.id)
      ) {
        return false;
      }

      const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
      end.setMinutes(end.getMinutes() + Number(entry.duration || 0));

      return end < now;
    });

    expiredEntries.forEach((entry) => {
      const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
      end.setMinutes(end.getMinutes() + Number(entry.duration || 0));
      const justCompleted = now.getTime() - end.getTime() <= 2 * 60 * 1000;

      autoCompletedCalendarEntryIdsRef.current.add(entry.id);
      completeCalendarVisit(entry, {notify: justCompleted});
    });
    if (expiredEntries.length > 0) {
      setAutoCompletedCalendarEntryIds((current) => [
        ...new Set([...current, ...expiredEntries.map((entry) => entry.id)]),
      ]);
    }
    // This reacts to calendar changes and guards repeated sync by entry id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEntries]);

  const updateCalendarEntryStatus = (entry, status) => {
    setCalendarEntries((current) =>
      current.map((item) => (item.id === entry.id ? {...item, status} : item)),
    );
    pushNotification({
      title: "Статус визита обновлён",
      message: `${entry.client}: ${status === "cancelled" ? "отменён" : "обновлён"}`,
    });
  };

  const remindCalendarClient = (entry) => {
    const client = clientProfiles.find((item) => item.name === entry.client);

    if (!client) {
      return;
    }

    setPreferredMessageClientId(String(client.id));
    setActivePage("templates");
    setClientAlertsOpen(false);
    setActiveClientAlertId(null);
  };

  const openClientMessageTemplates = (client) => {
    setPreferredMessageClientId(String(client.id));
    setActivePage("templates");
    setClientAlertsOpen(false);
    setActiveClientAlertId(null);
  };

  const requestCalendarAction = (type, entry) => {
    setPendingCalendarAction({type, entry});
  };

  const confirmCalendarAction = () => {
    if (!pendingCalendarAction) {
      return;
    }

    const {type, entry} = pendingCalendarAction;

    if (type === "edit") {
      openEditCalendarEntry(entry);
    } else if (type === "delete") {
      deleteCalendarEntry(entry);
    }

    setPendingCalendarAction(null);
  };

  const handleSettingsSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setAppSettings({
      studioName:
        String(form.get("studioName") ?? "").trim() ||
        defaultAppSettings.studioName,
      ownerName:
        String(form.get("ownerName") ?? "").trim() ||
        defaultAppSettings.ownerName,
      accentColor: form.get("accentColor") || defaultAppSettings.accentColor,
      theme: form.get("theme") || defaultAppSettings.theme,
      sidebarVisible: appSettings.sidebarVisible,
      compactMode: form.get("compactMode") === "on",
      animationsEnabled: appSettings.animationsEnabled,
      notificationsEnabled: form.get("notificationsEnabled") === "on",
      taskAlertsEnabled: form.get("taskAlertsEnabled") === "on",
      supplyAlertsEnabled: form.get("supplyAlertsEnabled") === "on",
      inactiveClientAlertsEnabled: form.get("inactiveClientAlertsEnabled") === "on",
      inactiveClientDays:
        Math.max(1, Number(form.get("inactiveClientDays"))) ||
        defaultAppSettings.inactiveClientDays,
      birthdayAlertsEnabled: form.get("birthdayAlertsEnabled") === "on",
      birthdayReminderDays:
        Math.max(0, Number(form.get("birthdayReminderDays"))) ||
        defaultAppSettings.birthdayReminderDays,
      todayVisitAlertsEnabled: form.get("todayVisitAlertsEnabled") === "on",
      smartVisitPopupsEnabled: form.get("smartVisitPopupsEnabled") === "on",
      smartVisitPopupMinutes:
        Math.max(5, Number(form.get("smartVisitPopupMinutes"))) ||
        defaultAppSettings.smartVisitPopupMinutes,
      todayVisitAlertMode:
        form.get("todayVisitAlertMode") || defaultAppSettings.todayVisitAlertMode,
      upcomingVisitMinutes:
        Math.max(15, Number(form.get("upcomingVisitMinutes"))) ||
        defaultAppSettings.upcomingVisitMinutes,
      calendarRemindersVisible: form.get("calendarRemindersVisible") === "on",
      calendarShowTasks: form.get("calendarShowTasks") === "on",
      calendarNowLineVisible: form.get("calendarNowLineVisible") === "on",
      calendarConflictWarnings: form.get("calendarConflictWarnings") === "on",
      workdayStart: form.get("workdayStart") || defaultAppSettings.workdayStart,
      workdayEnd: form.get("workdayEnd") || defaultAppSettings.workdayEnd,
      calendarSlotMinutes:
        Number(form.get("calendarSlotMinutes")) ||
        defaultAppSettings.calendarSlotMinutes,
      gmailClientId: String(form.get("gmailClientId") ?? "").trim(),
    });
    pushNotification({
      title: "Настройки сохранены",
      message: "Кастомизация салона обновлена",
    });
  };

  const resetSettings = () => {
    setAppSettings(defaultAppSettings);
    pushNotification({
      title: "Настройки сброшены",
      message: "Вернули стандартный вид NUAR",
    });
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const type = editingTask?.type === "note" ? "note" : "task";

    if (!title) return;

    const task = {
      id: editingTask?.id ?? createLocalId(),
      type,
      title,
      dueDate: form.get("dueDate") || "",
      priority: form.get("priority") || "Средний",
      note: String(form.get("note") ?? "").trim(),
      status: editingTask?.status ?? "active",
      createdAt: editingTask?.createdAt ?? new Date().toISOString(),
    };
    setTasks((current) =>
      editingTask
        ? current.map((item) => (item.id === task.id ? task : item))
        : [task, ...current],
    );
    setTaskModalOpen(false);
    setEditingTask(null);
    pushNotification({
      title: type === "note" ? "Заметка сохранена" : "Задача сохранена",
      message: task.title,
    });
  };

  const addQuickNote = ({title, category}) => {
    const note = {
      id: createLocalId(),
      type: "note",
      title,
      dueDate: "",
      priority: category || "Мысль",
      note: "",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    setTasks((current) => [note, ...current]);
    pushNotification({title: "Заметка добавлена", message: note.title});
  };

  const completeTask = (task) => {
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? {...item, status: "completed"} : item,
      ),
    );
    pushNotification({title: "Задача выполнена", message: task.title});
  };

  const reorderTasks = (draggedTaskId, targetTaskId) => {
    setTasks((current) => {
      const draggedIndex = current.findIndex((item) => item.id === draggedTaskId);
      const targetIndex = current.findIndex((item) => item.id === targetTaskId);

      if (draggedIndex === -1 || targetIndex === -1) return current;

      const nextTasks = [...current];
      const [draggedTask] = nextTasks.splice(draggedIndex, 1);
      nextTasks.splice(targetIndex, 0, draggedTask);
      return nextTasks;
    });
  };

  const deleteTask = (task) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    pushNotification({
      title: task.type === "note" ? "Заметка удалена" : "Задача удалена",
      message: task.title,
    });
  };

  const openCreateSupply = () => {
    setEditingSupply(null);
    setSupplyModalOpen(true);
  };

  const openEditSupply = (supply) => {
    setEditingSupply(supply);
    setSupplyModalOpen(true);
  };

  const handleSupplySubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();

    if (!name) return;

    const supply = {
      id: editingSupply?.id ?? createLocalId(),
      name,
      stock: Math.max(0, Number(form.get("stock")) || 0),
      minStock: Math.max(0, Number(form.get("minStock")) || 0),
      unit: form.get("unit") || "шт.",
      cost: Math.max(0, Number(form.get("cost")) || 0),
      note: String(form.get("note") ?? "").trim(),
    };
    setSupplies((current) =>
      editingSupply
        ? current.map((item) => (item.id === supply.id ? supply : item))
        : [supply, ...current],
    );
    setSupplyModalOpen(false);
    setEditingSupply(null);
    pushNotification({title: "Расходник сохранён", message: supply.name});
  };

  const changeSupplyStock = (supply, difference) => {
    setSupplies((current) =>
      current.map((item) =>
        item.id === supply.id
          ? {...item, stock: Math.max(0, Number(item.stock) + difference)}
          : item,
      ),
    );
  };

  const deleteSupply = (supply) => {
    setSupplies((current) => current.filter((item) => item.id !== supply.id));
    pushNotification({title: "Расходник удалён", message: supply.name});
  };

  const applyMailImports = (items) => {
    let nextClients = [...clientProfiles];
    let nextCalendarEntries = [...calendarEntries];
    let nextDocuments = [...importDocuments];
    const appliedIds = [];
    let addedClients = 0;
    let changedBookings = 0;

    const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
    const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

    items
      .sort((first, second) => first.receivedAt.localeCompare(second.receivedAt))
      .forEach((item) => {
        if (item.type === "document") {
          if (!nextDocuments.some((document) => document.id === item.id)) {
            nextDocuments = [item, ...nextDocuments];
          }
          appliedIds.push(item.id);
          return;
        }

        const importedClient = item.client;
        const booking = item.booking;
        const hasRequiredFields =
          importedClient.name &&
          booking.date &&
          booking.time &&
          booking.master &&
          booking.service;

        if (!hasRequiredFields) return;

        let client = nextClients.find(
          (candidate) =>
            importedClient.email &&
            normalizeText(candidate.email) === normalizeText(importedClient.email),
        );
        client ??= nextClients.find(
          (candidate) =>
            importedClient.phone &&
            normalizePhone(candidate.phone) === normalizePhone(importedClient.phone),
        );
        client ??= nextClients.find(
          (candidate) => normalizeText(candidate.name) === normalizeText(importedClient.name),
        );

        if (!client) {
          client = {
            id: createLocalId(),
            name: importedClient.name,
            phone: importedClient.phone,
            email: importedClient.email,
            birthday: "",
            instagram: "",
            telegram: "",
            source: "Booksy",
            preference: booking.master || "Любой мастер",
            status: "Новый",
            tags: "Booksy",
            note: "Добавлен автоматически из письма Booksy",
          };
          nextClients = [client, ...nextClients];
          addedClients += 1;
        } else if (client.source !== "Booksy") {
          nextClients = nextClients.map((candidate) =>
            candidate.id === client.id ? {...candidate, source: "Booksy"} : candidate,
          );
        }

        const previousDate = booking.previousDate || booking.date;
        const previousTime = booking.previousTime || booking.time;
        const existingEntry = nextCalendarEntries.find(
          (entry) =>
            entry.kind === "visit" &&
            normalizeText(entry.client) === normalizeText(client.name) &&
            (
              entry.date === previousDate &&
              entry.time === previousTime ||
              entry.date === booking.date &&
              entry.time === booking.time
            ),
        );
        const entry = {
          ...(existingEntry ?? {}),
          id: existingEntry?.id ?? createLocalId(),
          kind: "visit",
          status: booking.status || existingEntry?.status || "scheduled",
          completedAt: existingEntry?.completedAt ?? "",
          visitId: existingEntry?.visitId ?? "",
          date: booking.date,
          time: booking.time,
          duration: booking.duration,
          master: booking.master,
          client: client.name,
          serviceId: booking.serviceId,
          service: booking.service,
          amount: booking.amount,
          payment: existingEntry?.payment || "Не указано",
          packageUsageId: existingEntry?.packageUsageId ?? "",
          packageName: existingEntry?.packageName ?? "",
          packageSessionsUsed: existingEntry?.packageSessionsUsed ?? 0,
          color: getCalendarServiceColor({
            kind: "visit",
            serviceId: booking.serviceId,
            service: booking.service,
            color: existingEntry?.color,
          }),
          note: existingEntry?.note || "Импортировано из Gmail · Booksy",
          externalSource: "Booksy",
          externalMessageId: item.id,
        };

        nextCalendarEntries = existingEntry
          ? nextCalendarEntries.map((currentEntry) =>
              currentEntry.id === entry.id ? entry : currentEntry,
            )
          : [...nextCalendarEntries, entry];
        changedBookings += 1;
        appliedIds.push(item.id);
      });

    setClientProfiles(nextClients);
    setCalendarEntries(nextCalendarEntries);
    setImportDocuments(nextDocuments);
    setImportedMailIds((current) => [...new Set([...current, ...appliedIds])]);
    pushNotification({
      title: "Импорт Gmail завершён",
      message: `Записей: ${changedBookings} · новых клиентов: ${addedClients} · документов: ${items.filter((item) => item.type === "document").length}`,
      persist: false,
    });
  };

  const exportDataBackup = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      visits,
      employees,
      clients: clientProfiles,
      services: serviceCatalog,
      packages: packagesCatalog,
      clientPackages,
      messageTemplates,
      calendarEntries,
      dismissedClientAlertIds,
      communicationLog,
      notificationInbox,
      tasks,
      supplies,
      importDocuments,
      importedMailIds,
      settings: appSettings,
    };
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

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
  };

  const importDataBackup = async (event) => {
    const [file] = event.target.files ?? [];

    if (!file) {
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const requiredCollections = [
        "visits",
        "employees",
        "clients",
        "services",
        "packages",
        "clientPackages",
        "messageTemplates",
        "calendarEntries",
      ];
      const hasValidCollections = requiredCollections.every((key) =>
        Array.isArray(backup[key]),
      );

      if (!hasValidCollections || !backup.settings || typeof backup.settings !== "object") {
        throw new Error("Invalid backup");
      }

      setPendingDataBackup(backup);
    } catch {
      pushNotification({
        title: "Не удалось восстановить базу",
        message: "Выберите JSON-файл резервной копии NUAR CRM",
      });
    } finally {
      event.target.value = "";
    }
  };

  const confirmDataBackupImport = () => {
    if (!pendingDataBackup) {
      return;
    }

    setVisits(pendingDataBackup.visits);
    setEmployees(pendingDataBackup.employees);
    setClientProfiles(
      applyBooksySources(pendingDataBackup.clients, pendingDataBackup.visits),
    );
    setServiceCatalog(normalizeServiceColors(pendingDataBackup.services));
    setPackagesCatalog(pendingDataBackup.packages);
    setClientPackages(pendingDataBackup.clientPackages);
    setMessageTemplates(pendingDataBackup.messageTemplates);
    setCalendarEntries(pendingDataBackup.calendarEntries);
    setDismissedClientAlertIds(
      Array.isArray(pendingDataBackup.dismissedClientAlertIds)
        ? pendingDataBackup.dismissedClientAlertIds
        : [],
    );
    setCommunicationLog(
      Array.isArray(pendingDataBackup.communicationLog)
        ? pendingDataBackup.communicationLog
        : [],
    );
    setNotificationInbox(
      Array.isArray(pendingDataBackup.notificationInbox)
        ? pendingDataBackup.notificationInbox
        : [],
    );
    setTasks(Array.isArray(pendingDataBackup.tasks) ? pendingDataBackup.tasks : []);
    setSupplies(Array.isArray(pendingDataBackup.supplies) ? pendingDataBackup.supplies : []);
    setImportDocuments(
      Array.isArray(pendingDataBackup.importDocuments)
        ? pendingDataBackup.importDocuments
        : [],
    );
    setImportedMailIds(
      Array.isArray(pendingDataBackup.importedMailIds)
        ? pendingDataBackup.importedMailIds
        : [],
    );
    setAppSettings({...defaultAppSettings, ...pendingDataBackup.settings});
    setPendingDataBackup(null);
    pushNotification({
      title: "База восстановлена",
      message: "Данные из резервной копии загружены",
    });
  };

  const logClientMessage = ({client, channel, template, body}) => {
    setCommunicationLog((current) => [
      {
        id: createLocalId(),
        clientId: client.id,
        clientName: client.name,
        channel,
        templateName: template.name,
        body,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    pushNotification({
      title: "Контакт записан",
      message: `${client.name} · ${channel}`,
    });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!supabase) {
      pushNotification({
        title: "Supabase не настроен",
        message: "Добавьте VITE_SUPABASE_URL и publishable key",
        persist: false,
      });
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const {error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
      pushNotification({
        title: "Вход не выполнен",
        message: "Проверьте email и пароль",
        persist: false,
      });
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;

    const {error} = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes:
          "openid email profile https://www.googleapis.com/auth/gmail.readonly",
        queryParams: {
          access_type: "offline",
          include_granted_scopes: "true",
          prompt: "consent",
        },
      },
    });

    if (error) {
      pushNotification({
        title: "Вход через Google недоступен",
        message: error.message,
        persist: false,
      });
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    pushNotification({
      title: error ? "Не удалось отправить ссылку" : "Проверьте почту",
      message: error?.message || "Ссылка для сброса пароля отправлена на email",
      persist: false,
    });
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const {error} = await supabase.auth.updateUser({password});

    if (error) {
      pushNotification({
        title: "Не удалось изменить пароль",
        message: error.message,
        persist: false,
      });
      return;
    }

    setPasswordRecovery(false);
    window.history.replaceState({}, "", "/");
    pushNotification({
      title: "Пароль обновлён",
      message: "Теперь используйте новый пароль для входа",
      persist: false,
    });
  };

  const handleLogout = () => supabase?.auth.signOut();

  const isCalendarPage = activePage === "calendar";
  const isMastersPage = activePage === "masters";
  const isClientsPage = activePage === "clients";
  const isServicesPage = activePage === "services";
  const isPackagesPage = activePage === "packages";
  const isTemplatesPage = activePage === "templates";
  const isStatisticsPage = activePage === "statistics";
  const isSettingsPage = activePage === "settings";
  const isOperationsPage = activePage === "operations";
  const isImportPage = activePage === "import";
  const isPaymentsPage = activePage === "payments";
  const isSitePage = activePage === "site";
  const supportedPaths = ["/", "/reset-password"];
  const currentPath = window.location.pathname;

  if (!supportedPaths.includes(currentPath)) {
    return (
      <SystemScreen
        actionLabel="На главную"
        message="Такой страницы в CRM нет. Вернитесь к рабочему интерфейсу."
        mode="not-found"
        settings={appSettings}
        title="Страница не найдена"
        onAction={() => {
          window.history.replaceState({}, "", "/");
          window.location.reload();
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <SystemScreen
        message="Проверяем защищённую сессию владельца."
        settings={appSettings}
        title="Подключаем CRM"
      />
    );
  }

  if (!authSession || passwordRecovery) {
    return (
      <>
        <LoginPage
          isRecovery={passwordRecovery}
          settings={appSettings}
          onGoogleLogin={handleGoogleLogin}
          onResetPassword={handleResetPassword}
          onSubmit={handleLogin}
          onUpdatePassword={handleUpdatePassword}
        />
        <ToastStack notifications={notifications} onClose={closeNotification} />
      </>
    );
  }

  if (!cloudHydrated) {
    return (
      <SystemScreen
        actionLabel="Повторить"
        message={
          cloudLoadError ||
          "Получаем актуальные данные из защищённого хранилища Supabase."
        }
        mode={cloudLoadError ? "error" : "loading"}
        settings={appSettings}
        title={cloudLoadError ? "Не удалось загрузить базу" : "Загружаем CRM"}
        onAction={cloudLoadError ? () => window.location.reload() : undefined}
        onLogout={cloudLoadError ? handleLogout : undefined}
      />
    );
  }

  return (
    <AppShell
      compactMode={appSettings.compactMode}
      contentRef={contentRef}
      isCalendarPage={isCalendarPage}
      isPaymentsPage={isPaymentsPage}
      navigation={
        <AppNavigation
          activePage={activePage}
          mobileNavItems={mobileNavItems}
          navItems={navItems}
          ownerName={appSettings.ownerName}
          sidebarVisible={appSettings.sidebarVisible}
          studioName={appSettings.studioName}
          onLogout={handleLogout}
          onPageChange={setActivePage}
          onSidebarVisibleChange={(sidebarVisible) =>
            setAppSettings((current) => ({...current, sidebarVisible}))
          }
        />
      }
      pullRefresh={pullRefresh}
      sidebarVisible={appSettings.sidebarVisible}
      theme={appSettings.theme}
      onShellClick={() => {
        if (clientAlertsOpen) {
          setClientAlertsOpen(false);
        }
        if (openPaymentActionMenuId) {
          setOpenPaymentActionMenuId(null);
        }
      }}
      onTouchCancel={handlePullRefreshEnd}
      onTouchEnd={handlePullRefreshEnd}
      onTouchMove={handlePullRefreshMove}
      onTouchStart={handlePullRefreshStart}
      afterMain={
        <>
          <AppModals
            calendarEntries={calendarEntries}
            calendarEntryDefaults={calendarEntryDefaults}
            calendarEntryModalOpen={calendarEntryModalOpen}
            clientModalOpen={clientModalOpen}
            clientNames={clientNames}
            clientPackageModalOpen={clientPackageModalOpen}
            clientPackages={clientPackages}
            clientProfiles={clientProfiles}
            defaultStatsDate={DEFAULT_STATS_DATE}
            editingCalendarEntry={editingCalendarEntry}
            editingClient={editingClient}
            editingClientPackage={editingClientPackage}
            editingEmployee={editingEmployee}
            editingMessageTemplate={editingMessageTemplate}
            editingPackage={editingPackage}
            editingService={editingService}
            editingSupply={editingSupply}
            editingTask={editingTask}
            employeeModalOpen={employeeModalOpen}
            employees={employees}
            financialOperationModalOpen={financialOperationModalOpen}
            masters={masters}
            messageTemplateModalOpen={messageTemplateModalOpen}
            packageModalOpen={packageModalOpen}
            packagesCatalog={packagesCatalog}
            paymentRows={paymentRows}
            pendingCalendarAction={pendingCalendarAction}
            pendingCalendarConflict={pendingCalendarConflict}
            pendingDataBackup={pendingDataBackup}
            pendingPaymentDelete={pendingPaymentDelete}
            serviceCatalog={serviceCatalog}
            serviceModalOpen={serviceModalOpen}
            serviceNames={serviceNames}
            supplyModalOpen={supplyModalOpen}
            taskModalOpen={taskModalOpen}
            onCalendarEntrySubmit={handleCalendarEntrySubmit}
            onCancelCalendarAction={() => setPendingCalendarAction(null)}
            onCancelCalendarConflict={() => setPendingCalendarConflict(null)}
            onCancelDataBackup={() => setPendingDataBackup(null)}
            onCancelPaymentDelete={() => setPendingPaymentDelete(null)}
            onClientPackageSubmit={handleClientPackageSubmit}
            onClientSubmit={handleClientSubmit}
            onCloseCalendarEntryModal={() => {
              setCalendarEntryModalOpen(false);
              setEditingCalendarEntry(null);
              setCalendarEntryDefaults({});
            }}
            onCloseClientModal={() => {
              setClientModalOpen(false);
              setEditingClient(null);
            }}
            onCloseClientPackageModal={() => {
              setClientPackageModalOpen(false);
              setEditingClientPackage(null);
            }}
            onCloseEmployeeModal={() => {
              setEmployeeModalOpen(false);
              setEditingEmployee(null);
            }}
            onCloseFinancialOperationModal={() => setFinancialOperationModalOpen(false)}
            onCloseMessageTemplateModal={() => {
              setMessageTemplateModalOpen(false);
              setEditingMessageTemplate(null);
            }}
            onClosePackageModal={() => {
              setPackageModalOpen(false);
              setEditingPackage(null);
            }}
            onCloseServiceModal={() => {
              setServiceModalOpen(false);
              setEditingService(null);
            }}
            onCloseSupplyModal={() => {
              setSupplyModalOpen(false);
              setEditingSupply(null);
            }}
            onCloseTaskModal={() => {
              setTaskModalOpen(false);
              setEditingTask(null);
            }}
            onConfirmCalendarAction={confirmCalendarAction}
            onConfirmCalendarConflict={confirmCalendarConflict}
            onConfirmDataBackup={confirmDataBackupImport}
            onConfirmPaymentDelete={confirmPaymentDelete}
            onCreateCalendarClient={addCalendarFormClient}
            onEmployeeSubmit={handleEmployeeSubmit}
            onFinancialOperationSubmit={handleFinancialOperationSubmit}
            onMessageTemplateSubmit={handleMessageTemplateSubmit}
            onPackageSubmit={handlePackageSubmit}
            onServiceSubmit={handleServiceSubmit}
            onSupplySubmit={handleSupplySubmit}
            onTaskSubmit={handleTaskSubmit}
          />
          <ToastStack notifications={notifications} onClose={closeNotification} />
        </>
      }>
        {notificationSlot &&
          createPortal(
            <NotificationDrawer
              actionableNotificationInbox={actionableNotificationInbox}
              activeClientAlertId={activeClientAlertId}
              alertGroupsOpen={alertGroupsOpen}
              alertsCount={alertsCount}
              animationsEnabled={appSettings.animationsEnabled}
              birthdayAlerts={birthdayAlerts}
              inactiveClientAlerts={inactiveClientAlerts}
              isOpen={clientAlertsOpen}
              operationsAlerts={operationsAlerts}
              packageBalanceAlerts={packageBalanceAlerts}
              revenueForecastAlerts={revenueForecastAlerts}
              todayCalendarAlerts={todayCalendarAlerts}
              onDeleteInboxNotification={(notificationId) =>
                setNotificationInbox((current) =>
                  current.filter((item) => item.id !== notificationId),
                )
              }
              onDismissAlert={dismissAlertTemporarily}
              onDismissClientAlert={(alertId) => {
                setDismissedClientAlertIds((current) => [...current, alertId]);
                setActiveClientAlertId(null);
              }}
              onOpenAlertPage={(page) => {
                setActivePage(page);
                setClientAlertsOpen(false);
              }}
              onOpenCalendar={() => {
                setActivePage("calendar");
                setClientAlertsOpen(false);
                setActiveClientAlertId(null);
              }}
              onOpenClientMessageTemplates={openClientMessageTemplates}
              onOpenClients={() => {
                setActivePage("clients");
                setClientAlertsOpen(false);
                setActiveClientAlertId(null);
              }}
              onOpenTemplatesForClient={(client) => {
                setPreferredMessageClientId(String(client.id));
                setActivePage("templates");
                setClientAlertsOpen(false);
                setActiveClientAlertId(null);
              }}
              onRemindCalendarClient={remindCalendarClient}
              onToggleActiveAlert={(alertId) =>
                setActiveClientAlertId((current) =>
                  current === alertId ? null : alertId,
                )
              }
              onToggleGroup={(group) =>
                setAlertGroupsOpen((current) => ({
                  ...current,
                  [group]: !current[group],
                }))
              }
              onToggleOpen={() => setClientAlertsOpen((current) => !current)}
              onUndoNotificationAction={undoNotificationAction}
            />,
            notificationSlot,
          )}
        <PageNotificationsProvider onSlotChange={setNotificationSlot}>
        {isCalendarPage ? (
          <CalendarPage
            entries={calendarEntriesWithServiceColors}
            visits={visits}
            clients={clientProfiles}
            clientPackages={clientPackages}
            employees={employees.filter((employee) => employee.status !== "Архив")}
            settings={appSettings}
            onAdd={openCreateCalendarEntry}
            onEdit={(entry) => requestCalendarAction("edit", entry)}
            onDelete={(entry) => requestCalendarAction("delete", entry)}
            onMove={moveCalendarEntry}
            onRemind={remindCalendarClient}
            onStatus={updateCalendarEntryStatus}
            overlayOpen={calendarEntryModalOpen}
          />
        ) : isPaymentsPage ? (
          <PaymentsPage
            filters={paymentFilters}
            masters={masters}
            openActionMenuId={openPaymentActionMenuId}
            visits={filteredPaymentRows}
            onAddPayment={() => setFinancialOperationModalOpen(true)}
            onDeleteVisit={deletePaymentRow}
            onFilterChange={(key, value) =>
              setPaymentFilters((current) => ({...current, [key]: value}))
            }
            onResetFilters={() =>
              setPaymentFilters({master: "", payment: "", client: "", date: ""})
            }
            onToggleActionMenu={setOpenPaymentActionMenuId}
          />
        ) : isClientsPage ? (
          <ClientsPage
            visits={visits}
            calendarEntries={calendarEntries}
            clients={clientProfiles}
            clientPackages={clientPackages}
            communicationLog={communicationLog}
            employees={employees}
            inactiveClientDays={inactiveClientDays}
            onAddClient={openCreateClient}
            onEditClient={openEditClient}
            onDeleteClient={deleteClient}
            onMessageClient={openClientMessageTemplates}
            onAddVisit={addClientCalendarVisit}
            onRepeatVisit={repeatClientVisit}
          />
        ) : isServicesPage ? (
          <ServicesPage
            services={serviceCatalog}
            onAdd={openCreateService}
            onEdit={openEditService}
            onDelete={deleteService}
          />
        ) : isPackagesPage ? (
          <PackagesPage
            packages={packagesCatalog}
            clientPackages={clientPackages}
            certificates={visits.filter(
              (visit) =>
                visit.recordType === "operation" &&
                visit.service === "Продажа сертификата",
            )}
            packageSalesIncome={packageSalesIncome}
            onAdd={openCreatePackage}
            onEdit={openEditPackage}
            onDelete={deletePackage}
            onSellPackage={openCreateClientPackage}
            onEditClientPackage={openEditClientPackage}
            onDeleteClientPackage={deleteClientPackage}
          />
        ) : isMastersPage ? (
          <EmployeesPage
            employees={employeeStats}
            onAdd={openCreateEmployee}
            onEdit={openEditEmployee}
            onDelete={deleteEmployee}
          />
        ) : isTemplatesPage ? (
          <MessageTemplatesPage
            templates={messageTemplates}
            clients={clientProfiles}
            preferredClientId={preferredMessageClientId}
            onClearPreferredClient={() => setPreferredMessageClientId("")}
            onAdd={openCreateMessageTemplate}
            onEdit={openEditMessageTemplate}
            onDelete={deleteMessageTemplate}
            onNotify={pushNotification}
            onMessageSent={logClientMessage}
          />
        ) : isOperationsPage ? (
          <OperationsPage
            tasks={tasks}
            supplies={supplies}
            onAddTask={openCreateTask}
            onAddNote={addQuickNote}
            onEditTask={openEditTask}
            onDeleteTask={deleteTask}
            onCompleteTask={completeTask}
            onReorderTasks={reorderTasks}
            onAddSupply={openCreateSupply}
            onEditSupply={openEditSupply}
            onDeleteSupply={deleteSupply}
            onChangeSupplyStock={changeSupplyStock}
          />
        ) : isImportPage ? (
          <ImportPage
            documents={importDocuments}
            employees={employees}
            gmailAccessToken={authSession?.provider_token ?? ""}
            gmailClientId={appSettings.gmailClientId}
            importedMailIds={importedMailIds}
            services={serviceCatalog}
            onApply={applyMailImports}
            onGoogleLogin={handleGoogleLogin}
            onNotify={pushNotification}
            onOpenSettings={() => setActivePage("settings")}
          />
        ) : isStatisticsPage ? (
          <StatisticsPage
            visits={paymentRows}
            calendarEntries={calendarEntries}
            clientPackages={clientPackages}
            clients={clientProfiles}
            employees={employees}
          />
        ) : isSitePage ? (
          <SitePage services={serviceCatalog} />
        ) : isSettingsPage ? (
          <SettingsPage
            settings={appSettings}
            onSubmit={handleSettingsSubmit}
            onReset={resetSettings}
            onExportData={exportDataBackup}
            onImportData={importDataBackup}
          />
        ) : (
          <StatisticsPage
            visits={paymentRows}
            calendarEntries={calendarEntries}
            clientPackages={clientPackages}
            clients={clientProfiles}
            employees={employees}
          />
        )}
        </PageNotificationsProvider>
    </AppShell>
  );
}

export default App;
