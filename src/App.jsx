import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  EyeOff,
  LogOut,
  MailSearch,
  MessageSquareText,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ChartNoAxesCombined,
  User,
  Users,
  X,
} from "lucide-react";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import EmployeeForm from "./components/EmployeeForm.jsx";
import LoginPage from "./components/LoginPage.jsx";
import NewClientForm from "./components/NewClientForm.jsx";
import NewVisitForm from "./components/NewVisitForm.jsx";
import MessageTemplateForm from "./components/MessageTemplateForm.jsx";
import CalendarEntryForm from "./components/CalendarEntryForm.jsx";
import SupplyForm from "./components/SupplyForm.jsx";
import TaskForm from "./components/TaskForm.jsx";
import PackageForm from "./components/PackageForm.jsx";
import ServiceForm from "./components/ServiceForm.jsx";
import ToastStack from "./components/ToastStack.jsx";
import "./App.css";
import {
  initialEmployees,
  initialClients,
  initialPackages,
  initialServices,
  visitsSeed,
} from "./data/seed.js";
import ClientPackageForm from "./components/ClientPackageForm.jsx";
import {
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
  toInputDate,
} from "./utils/formatters.jsx";
import {getEmployeePayout, toVisitNumber} from "./utils/visits.jsx";
import VisitsTable from "./components/VisitsTable.jsx";
import EmployeesPage from "./components/EmployeesPage.jsx";
import ClientsPage from "./components/pages/ClientsPage.jsx";
import PackagesPage from "./components/pages/PackagesPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import ServicesPage from "./components/pages/ServicesPage.jsx";
import MessageTemplatesPage from "./components/pages/MessageTemplatesPage.jsx";
import CalendarPage from "./components/pages/CalendarPage.jsx";
import StatisticsPage from "./components/pages/StatisticsPage.jsx";
import OperationsPage from "./components/pages/OperationsPage.jsx";
import ImportPage from "./components/pages/ImportPage.jsx";
import {isSupabaseConfigured, supabase} from "./lib/supabase.js";

const navItems = [
  {label: "Статистика", page: "statistics", icon: ChartNoAxesCombined},
  {label: "Визиты", page: "visits", icon: ClipboardList},
  {label: "Календарь", page: "calendar", icon: CalendarDays},
  {label: "Клиенты", page: "clients", icon: Users},
  {label: "Сотрудники", page: "masters", icon: User},
  {label: "Услуги", page: "services", icon: BriefcaseBusiness},
  {label: "Пакеты", page: "packages", icon: Package},
  {label: "Задачи", page: "operations", icon: PackageSearch},
  {label: "Импорт", page: "import", icon: MailSearch},
  {label: "Шаблоны", page: "templates", icon: MessageSquareText},
  {label: "Настройки", page: "settings", icon: Settings},
];

const VISITS_STORAGE_KEY = "nuar-crm-visits-2026-05-import";
const ACTIVE_PAGE_STORAGE_KEY = "nuar-crm-active-page";
const EMPLOYEES_STORAGE_KEY = "nuar-crm-employees-2026-05-import";
const CLIENTS_STORAGE_KEY = "nuar-crm-clients-2026-05-import";
const SERVICES_STORAGE_KEY = "nuar-crm-services-2026-05-import";
const PACKAGES_STORAGE_KEY = "nuar-crm-packages-2026-05-import";
const CLIENT_PACKAGES_STORAGE_KEY = "nuar-crm-client-packages-2026-05-import";
const MESSAGE_TEMPLATES_STORAGE_KEY = "nuar-crm-message-templates";
const CALENDAR_ENTRIES_STORAGE_KEY = "nuar-crm-calendar-entries";
const DISMISSED_CLIENT_ALERTS_STORAGE_KEY = "nuar-crm-dismissed-client-alerts";
const COMMUNICATION_LOG_STORAGE_KEY = "nuar-crm-communication-log";
const NOTIFICATION_INBOX_STORAGE_KEY = "nuar-crm-notification-inbox";
const SETTINGS_STORAGE_KEY = "nuar-crm-settings";
const TASKS_STORAGE_KEY = "nuar-crm-tasks";
const SUPPLIES_STORAGE_KEY = "nuar-crm-supplies";
const IMPORT_DOCUMENTS_STORAGE_KEY = "nuar-crm-import-documents";
const IMPORTED_MAIL_IDS_STORAGE_KEY = "nuar-crm-imported-mail-ids";
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
  accentColor: "#d2ad7d",
  theme: "light",
  sidebarVisible: true,
  compactMode: true,
  animationsEnabled: true,
  notificationsEnabled: true,
  taskAlertsEnabled: true,
  supplyAlertsEnabled: true,
  inactiveClientAlertsEnabled: true,
  inactiveClientDays: 14,
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

const DEFAULT_STATS_DATE = getTodayInput();

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
      return initialServices;
    }

    const parsedServices = JSON.parse(storedServices);
    return Array.isArray(parsedServices) ? parsedServices : initialServices;
  } catch {
    return initialServices;
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

const loadStoredSettings = () => {
  try {
    const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return defaultAppSettings;
    }

    const parsedSettings = JSON.parse(storedSettings);
    delete parsedSettings.authLogin;
    delete parsedSettings.authPassword;
    return {
      ...defaultAppSettings,
      ...parsedSettings,
    };
  } catch {
    return defaultAppSettings;
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
  const [appSettings, setAppSettings] = useState(loadStoredSettings);
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState("");
  const [activePage, setActivePage] = useState(loadStoredActivePage);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [clientPackageModalOpen, setClientPackageModalOpen] = useState(false);
  const [messageTemplateModalOpen, setMessageTemplateModalOpen] = useState(false);
  const [calendarEntryModalOpen, setCalendarEntryModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingClientPackage, setEditingClientPackage] = useState(null);
  const [editingMessageTemplate, setEditingMessageTemplate] = useState(null);
  const [editingCalendarEntry, setEditingCalendarEntry] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingSupply, setEditingSupply] = useState(null);
  const [calendarEntryDefaults, setCalendarEntryDefaults] = useState({});
  const [pendingVisit, setPendingVisit] = useState(null);
  const [pendingCalendarAction, setPendingCalendarAction] = useState(null);
  const [pendingCalendarConflict, setPendingCalendarConflict] = useState(null);
  const [pendingDataBackup, setPendingDataBackup] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [clientAlertsOpen, setClientAlertsOpen] = useState(false);
  const [alertGroupsOpen, setAlertGroupsOpen] = useState({
    system: false,
    calendar: false,
    inactive: false,
    operations: false,
  });
  const [activeClientAlertId, setActiveClientAlertId] = useState(null);
  const [preferredMessageClientId, setPreferredMessageClientId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const smartVisitAlertIds = useRef(new Set());
  const cloudSnapshotRef = useRef(null);
  const [filters, setFilters] = useState({
    master: "",
    payment: "",
    client: "",
    date: "",
  });

  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) => {
        const matchesMaster =
          !filters.master || visit.master === filters.master;
        const matchesPayment =
          !filters.payment || String(visit.payment ?? "").includes(filters.payment);
        const matchesClient =
          !filters.client ||
          String(visit.client ?? "")
            .toLowerCase()
            .includes(filters.client.toLowerCase());
        const matchesDate =
          !filters.date || toInputDate(visit.date) === filters.date;

        return matchesMaster && matchesPayment && matchesClient && matchesDate;
      }),
    [filters, visits],
  );

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
  const inactiveClients = useMemo(
    () =>
      clientProfiles
        .map((client) => {
          const lastVisit =
            getLatestDisplayDate(
              visits
                .filter((visit) => visit.client === client.name)
                .map((visit) => visit.date),
            ) || "";

          return {
            ...client,
            lastVisit,
            daysAbsent: getDaysSinceDisplayDate(lastVisit),
          };
        })
        .filter(
          (client) =>
            (client.daysAbsent === null || client.daysAbsent >= inactiveClientDays),
        )
        .sort(
          (firstClient, secondClient) =>
            (secondClient.daysAbsent ?? Number.MAX_SAFE_INTEGER) -
            (firstClient.daysAbsent ?? Number.MAX_SAFE_INTEGER),
        ),
    [clientProfiles, inactiveClientDays, visits],
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

  const actionableNotificationInbox = useMemo(
    () => notificationInbox.filter((notification) => notification.undoAction),
    [notificationInbox],
  );

  const alertsCount =
    todayCalendarAlerts.length +
    inactiveClientAlerts.length +
    actionableNotificationInbox.length +
    operationsAlerts.length;
  const serviceNames = useMemo(
    () => serviceCatalog.map((service) => service.name),
    [serviceCatalog],
  );

  const packageSalesIncome = useMemo(
    () =>
      clientPackages.reduce(
        (sum, packageItem) => sum + (Number(packageItem.price) || 0),
        0,
      ),
    [clientPackages],
  );

  useEffect(() => {
    window.localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(visits));
  }, [visits]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage);
  }, [activePage]);

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
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(appSettings),
    );
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

  const applyCloudSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;

    if (Array.isArray(snapshot.visits)) setVisits(snapshot.visits);
    if (Array.isArray(snapshot.employees)) setEmployees(snapshot.employees);
    if (Array.isArray(snapshot.clients)) {
      setClientProfiles(applyBooksySources(snapshot.clients, snapshot.visits ?? []));
    }
    if (Array.isArray(snapshot.services)) setServiceCatalog(snapshot.services);
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
    if (snapshot.settings && typeof snapshot.settings === "object") {
      const safeSettings = {...snapshot.settings};
      delete safeSettings.authLogin;
      delete safeSettings.authPassword;
      setAppSettings({...defaultAppSettings, ...safeSettings});
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    supabase.auth.getSession().then(({data}) => {
      if (!active) return;
      setAuthSession(data.session);
      setAuthReady(true);
    });
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      setAuthReady(true);
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
          (visit) => visit.master === employee.name,
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

  const handleVisitSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = toVisitNumber(form.get("amount"));
    const tip = toVisitNumber(form.get("tip"));
    const commission = toVisitNumber(form.get("commission"));
    const extra = toVisitNumber(form.get("extra"));
    const discount = toVisitNumber(form.get("discount"));
    const commissionType = form.get("commissionType");
    const packageSessionsUsed = Number(form.get("packageSessionsUsed")) || 0;
    const packageUsageId = Number(form.get("packageUsageId")) || "";
    const selectedClientPackage = clientPackages.find(
      (packageItem) => packageItem.id === packageUsageId,
    );

    setPendingVisit({
      form: event.currentTarget,
      mode: editingVisit ? "edit" : "create",
      previousVisit: editingVisit,
      visit: {
        id: editingVisit?.id ?? createLocalId(),
        date: toDisplayDate(form.get("date")),
        client: form.get("client"),
        master: form.get("master"),
        service: form.get("service"),
        duration: "",
        amount,
        payment: form.get("payment"),
        packageUsageId,
        packageName: selectedClientPackage?.packageName ?? "",
        packageSessionsUsed,
        tip,
        commission,
        commissionType,
        extra,
        discount,
      },
    });
  };

  const archiveNotification = (notification) => {
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
  };

  const pushNotification = (notification) => {
    const id = createLocalId();
    const nextNotification = {id, ...notification};
    setNotifications((current) => [...current, nextNotification]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
      archiveNotification(nextNotification);
    }, 4200);
  };

  const closeNotification = (id) => {
    archiveNotification(notifications.find((item) => item.id === id));
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

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
          const notification = {
            id: createLocalId(),
            title: difference === 0 ? "Визит начинается сейчас" : `Визит через ${difference} мин.`,
            message: `${entry.client} · ${entry.service} · ${entry.master}`,
          };

          setNotifications((current) => [...current, notification]);
          window.setTimeout(() => {
            setNotifications((current) =>
              current.filter((item) => item.id !== notification.id),
            );
          }, 4200);
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
  ]);

  const confirmVisitSave = () => {
    if (!pendingVisit) {
      return;
    }

    if (pendingVisit.mode === "edit") {
      setVisits((current) =>
        current.map((visit) =>
          visit.id === pendingVisit.visit.id ? pendingVisit.visit : visit,
        ),
      );
    } else {
      setVisits((current) => [pendingVisit.visit, ...current]);
    }
    if (pendingVisit.visit.commissionType === "Booksy 45%") {
      setClientProfiles((current) =>
        current.map((client) =>
          client.name === pendingVisit.visit.client
            ? {...client, source: "Booksy"}
            : client,
        ),
      );
    }
    updatePackageBalance(pendingVisit.previousVisit, pendingVisit.visit);
    pendingVisit.form.reset();
    setVisitModalOpen(false);
    setEditingVisit(null);
    pushNotification({
      title: pendingVisit.mode === "edit" ? "Визит обновлен" : "Визит сохранен",
      message: `${pendingVisit.visit.client} сохранен в журнале визитов`,
    });
    setPendingVisit(null);
  };

  const openCreateVisit = () => {
    setEditingVisit(null);
    setVisitModalOpen(true);
  };

  const openEditVisit = (visit) => {
    setOpenActionMenuId(null);
    setEditingVisit({...visit, date: toInputDate(visit.date)});
    setVisitModalOpen(true);
  };

  const deleteVisit = (visit) => {
    setOpenActionMenuId(null);
    updatePackageBalance(visit, null);
    setVisits((current) => current.filter((item) => item.id !== visit.id));
    pushNotification({
      title: "Визит удален",
      message: `${visit.client} удален из журнала визитов`,
    });
  };

  const openCreateEmployee = () => {
    setEditingEmployee(null);
    setEmployeeModalOpen(true);
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

  const openCreateClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const handleClientSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      color: form.get("color") || "#4f8edc",
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
      message: `${clientPackage.client}: ${clientPackage.remainingVisits} из ${clientPackage.totalVisits}`,
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

  const openEditCalendarEntry = (entry) => {
    setEditingCalendarEntry(entry);
    setCalendarEntryDefaults({});
    setCalendarEntryModalOpen(true);
  };

  const getCalendarConflicts = (entry, ignoredId = null) => {
    if (entry.kind !== "visit") {
      return [];
    }

    const entryStart = Number(String(entry.time).split(":")[0]) * 60 +
      Number(String(entry.time).split(":")[1]);
    const entryEnd = entryStart + Number(entry.duration);

    return calendarEntries.filter((item) => {
      if (
        item.id === ignoredId ||
        item.kind !== "visit" ||
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

  const saveCalendarEntry = (entry, isEditing) => {
    setCalendarEntries((current) =>
      isEditing
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [...current, entry],
    );
    setCalendarEntryModalOpen(false);
    setEditingCalendarEntry(null);
    setCalendarEntryDefaults({});
    pushNotification({
      title: isEditing ? "Календарь обновлен" : "Добавлено в календарь",
      message: entry.kind === "task" ? entry.title : `${entry.client} · ${entry.time}`,
    });
  };

  const handleCalendarEntrySubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = form.get("kind");
    const service = serviceCatalog.find(
      (item) => String(item.id) === String(form.get("serviceId")),
    );
    const packageUsageId = Number(form.get("packageUsageId")) || "";
    const duration = Number(form.get("duration")) || 60;
    const serviceVariant = service?.variants?.find(
      (variant) => Number(variant.duration) === duration,
    );
    const entry = {
      id: editingCalendarEntry?.id ?? createLocalId(),
      status: editingCalendarEntry?.status ?? "scheduled",
      completedAt: editingCalendarEntry?.completedAt ?? "",
      visitId: editingCalendarEntry?.visitId ?? "",
      kind,
      date: form.get("date"),
      time: form.get("time"),
      duration,
      master: form.get("master"),
      title: kind === "task" ? String(form.get("title") ?? "").trim() : "",
      client: kind === "visit" ? form.get("client") : "",
      serviceId: kind === "visit" ? Number(form.get("serviceId")) : "",
      service: kind === "visit" ? service?.name ?? "" : "",
      amount:
        kind === "visit"
          ? toVisitNumber(form.get("amount")) || toVisitNumber(serviceVariant?.price)
          : 0,
      payment: kind === "visit" ? form.get("payment") : "",
      packageUsageId,
      packageName:
        clientPackages.find((item) => item.id === packageUsageId)?.packageName ?? "",
      packageSessionsUsed: packageUsageId ? 1 : 0,
      color: form.get("color") || "#748091",
      note: String(form.get("note") ?? "").trim(),
    };

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
      title: entry.kind === "task" ? "Задача удалена" : "Запись отменена",
      message: entry.kind === "task" ? entry.title : entry.client,
    });
  };

  const moveCalendarEntry = (entryId, nextPosition) => {
    const currentEntry = calendarEntries.find((entry) => entry.id === entryId);
    const movedEntry = currentEntry ? {...currentEntry, ...nextPosition} : null;
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
  };

  const confirmCalendarConflict = () => {
    if (!pendingCalendarConflict) {
      return;
    }

    const {entry, isEditing, type} = pendingCalendarConflict;

    if (type === "move") {
      setCalendarEntries((current) =>
        current.map((item) => (item.id === entry.id ? entry : item)),
      );
    } else {
      saveCalendarEntry(entry, isEditing);
    }

    setPendingCalendarConflict(null);
  };

  const completeCalendarVisit = (entry) => {
    if (["completed", "cancelled", "no_show"].includes(entry.status)) {
      return;
    }

    const matchedService = serviceCatalog.find(
      (service) => String(service.id) === String(entry.serviceId),
    );
    const matchedVariant = matchedService?.variants?.find(
      (variant) => Number(variant.duration) === Number(entry.duration),
    );
    const visit = {
      id: createLocalId(),
      date: toDisplayDate(entry.date),
      client: entry.client,
      master: entry.master,
      service: entry.service,
      duration: "",
      amount: toVisitNumber(entry.amount) || toVisitNumber(matchedVariant?.price),
      payment: entry.payment || "Не указано",
      packageUsageId: entry.packageUsageId || "",
      packageName: entry.packageName || "",
      packageSessionsUsed: entry.packageSessionsUsed || 0,
      tip: 0,
      commission: 0,
      commissionType: "Без комиссии",
      extra: 0,
      discount: 0,
      note: entry.note || "",
    };

    setVisits((current) => [visit, ...current]);
    updatePackageBalance(null, visit);
    setCalendarEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {...item, status: "completed", completedAt: new Date().toISOString(), visitId: visit.id}
          : item,
      ),
    );
    pushNotification({
      title: "Визит завершен",
      message: `${entry.client} добавлен в журнал визитов`,
    });
  };

  const updateCalendarEntryStatus = (entry, status) => {
    setCalendarEntries((current) =>
      current.map((item) => (item.id === entry.id ? {...item, status} : item)),
    );
    pushNotification({
      title: "Статус визита обновлён",
      message: `${entry.client}: ${status === "no_show" ? "no-show" : status === "cancelled" ? "отменён" : "подтверждён"}`,
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
    } else if (type === "complete") {
      completeCalendarVisit(entry);
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

    if (!title) return;

    const task = {
      id: editingTask?.id ?? createLocalId(),
      title,
      dueDate: form.get("dueDate") || "",
      priority: form.get("priority") || "Средний",
      note: String(form.get("note") ?? "").trim(),
      status: editingTask?.status ?? "active",
    };
    setTasks((current) =>
      editingTask
        ? current.map((item) => (item.id === task.id ? task : item))
        : [task, ...current],
    );
    setTaskModalOpen(false);
    setEditingTask(null);
    pushNotification({title: "Задача сохранена", message: task.title});
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
    pushNotification({title: "Задача удалена", message: task.title});
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
        const service = serviceCatalog.find(
          (catalogItem) => String(catalogItem.id) === String(booking.serviceId),
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
          color: service?.color || existingEntry?.color || "#4f8edc",
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
    setServiceCatalog(pendingDataBackup.services);
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

  const handleLogout = () => supabase?.auth.signOut();

  const isVisitsPage = activePage === "visits";
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
  const handleFilterChange = (name, value) => {
    setFilters((current) => ({...current, [name]: value}));
  };

  const resetFilters = () => {
    setFilters({
      master: "",
      payment: "",
      client: "",
      date: "",
    });
  };

  if (!authReady) {
    return <main className="login-screen" />;
  }

  if (!authSession) {
    return (
      <>
        <LoginPage settings={appSettings} onSubmit={handleLogin} />
        <ToastStack notifications={notifications} onClose={closeNotification} />
      </>
    );
  }

  if (!cloudHydrated) {
    return (
      <main className={`login-screen theme-${appSettings.theme}`}>
        <section className="login-card">
          <div className="login-brand">
            <span className="login-brand-mark">N</span>
            <div>
              <strong>{appSettings.studioName}</strong>
              <small>CRM</small>
            </div>
          </div>
          <div className="login-heading">
            <div>
              <h1>{cloudLoadError ? "Не удалось загрузить базу" : "Загружаем CRM"}</h1>
              <p>
                {cloudLoadError ||
                  "Получаем актуальные данные из защищённого хранилища Supabase."}
              </p>
            </div>
          </div>
          {cloudLoadError && (
            <button className="secondary-button" type="button" onClick={handleLogout}>
              Выйти
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <div
      className={`crm-shell theme-${appSettings.theme} ${
        appSettings.sidebarVisible ? "" : "sidebar-hidden"
      } ${appSettings.compactMode ? "compact-mode" : ""}`}
      onClick={() => {
        if (openActionMenuId) {
          setOpenActionMenuId(null);
        }
        if (clientAlertsOpen) {
          setClientAlertsOpen(false);
        }
      }}>
      <aside className="sidebar">
        <div className="logo" aria-label={`${appSettings.studioName} CRM`}>
          <span className="logo-mark">N</span>
          <div className="logo-wordmark">
            <strong>{appSettings.studioName}</strong>
            <small>CRM</small>
          </div>
        </div>
        <button
          aria-label="Скрыть меню"
          className="sidebar-collapse-button"
          title="Скрыть меню"
          type="button"
          onClick={() =>
            setAppSettings((current) => ({...current, sidebarVisible: false}))
          }>
          <PanelLeftClose size={17} />
        </button>

        <nav className="nav-list" aria-label="Главное меню">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activePage === item.page ? "active" : ""}
                key={item.label}
                onClick={() => {
                  setActivePage(item.page);

                  if (window.innerWidth <= 700) {
                    setAppSettings((current) => ({
                      ...current,
                      sidebarVisible: false,
                    }));
                  }
                }}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="owner-card">
          <div className="owner-avatar">В</div>
          <div>
            <strong>{appSettings.ownerName}</strong>
            <span>Владелец</span>
          </div>
          <button
            className="logout-button"
            type="button"
            aria-label="Выйти"
            onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {!appSettings.sidebarVisible && (
        <button
          className="sidebar-restore-button"
          type="button"
          aria-label="Показать меню"
          onClick={() =>
            setAppSettings((current) => ({...current, sidebarVisible: true}))
          }>
          <PanelLeftOpen size={18} />
        </button>
      )}

      <main
        className={`content ${isVisitsPage ? "visits-content" : "home-content"}`}>
        <header className="page-header">
          <div
            className="page-header-actions"
            onClick={(event) => event.stopPropagation()}>
            <div className="client-alert-control">
              <button
                aria-label="Центр уведомлений"
                className="client-alert-button"
                type="button"
                onClick={() => setClientAlertsOpen((current) => !current)}>
                <Bell size={18} />
                {alertsCount > 0 && <b>{alertsCount}</b>}
              </button>
              <AnimatePresence>
              {clientAlertsOpen && (
                <motion.div
                  animate={{opacity: 1, y: 0, scale: 1}}
                  className="client-alert-popover"
                  exit={{opacity: 0, y: -6, scale: 0.98}}
                  initial={{opacity: 0, y: -8, scale: 0.98}}
                  transition={{duration: appSettings.animationsEnabled ? 0.18 : 0}}>
                  <div className="client-alert-heading">
                    <div>
                      <h2>Уведомления</h2>
                      <p>Только события, требующие внимания</p>
                    </div>
                    <strong>{alertsCount}</strong>
                  </div>
                  <div className="client-alert-list">
                    {actionableNotificationInbox.length > 0 && (
                      <div className="client-alert-group">
                        <button
                          className="client-alert-group-toggle"
                          type="button"
                          onClick={() =>
                            setAlertGroupsOpen((current) => ({
                              ...current,
                              system: !current.system,
                            }))
                          }>
                          Корзина изменений <b>{actionableNotificationInbox.length}</b>
                          <ChevronDown className={alertGroupsOpen.system ? "open" : ""} size={14} />
                        </button>
                        <AnimatePresence initial={false}>
                          {alertGroupsOpen.system && (
                            <motion.div
                              animate={{height: "auto", opacity: 1}}
                              exit={{height: 0, opacity: 0}}
                              initial={{height: 0, opacity: 0}}
                              transition={{duration: appSettings.animationsEnabled ? 0.18 : 0}}>
                              {actionableNotificationInbox.map((notification) => (
                                <div className="client-alert-row" key={notification.id}>
                                  <div className="client-alert-event">
                                  <div>
                                    <strong>{notification.title}</strong>
                                    <span>{notification.message}</span>
                                  </div>
                                  {notification.undoAction && (
                                    <button
                                      aria-label="Вернуть изменение"
                                      className="client-alert-undo"
                                      title="Вернуть изменение"
                                      type="button"
                                      onClick={() => undoNotificationAction(notification)}>
                                      Вернуть
                                    </button>
                                  )}
                                  <button
                                      aria-label="Убрать событие"
                                      title="Убрать"
                                      type="button"
                                      onClick={() =>
                                        setNotificationInbox((current) =>
                                          current.filter((item) => item.id !== notification.id),
                                        )
                                      }>
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {operationsAlerts.length > 0 && (
                      <div className="client-alert-group">
                        <button
                          className="client-alert-group-toggle"
                          type="button"
                          onClick={() =>
                            setAlertGroupsOpen((current) => ({
                              ...current,
                              operations: !current.operations,
                            }))
                          }>
                          Задачи и склад <b>{operationsAlerts.length}</b>
                          <ChevronDown className={alertGroupsOpen.operations ? "open" : ""} size={14} />
                        </button>
                        <AnimatePresence initial={false}>
                          {alertGroupsOpen.operations && (
                            <motion.div
                              animate={{height: "auto", opacity: 1}}
                              exit={{height: 0, opacity: 0}}
                              initial={{height: 0, opacity: 0}}
                              transition={{duration: appSettings.animationsEnabled ? 0.18 : 0}}>
                              {operationsAlerts.map((alert) => (
                                <div className="client-alert-row" key={alert.alertId}>
                                  <button
                                    className="client-alert-summary"
                                    type="button"
                                    onClick={() => {
                                      setActivePage(alert.page);
                                      setClientAlertsOpen(false);
                                    }}>
                                    <div>
                                      <strong>{alert.title}</strong>
                                      <span>{alert.message}</span>
                                    </div>
                                    <b>Открыть</b>
                                  </button>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {todayCalendarAlerts.length > 0 && (
                      <div className="client-alert-group">
                        <button
                          className="client-alert-group-toggle"
                          type="button"
                          onClick={() =>
                            setAlertGroupsOpen((current) => ({
                              ...current,
                              calendar: !current.calendar,
                            }))
                          }>
                          Ближайшие визиты <b>{todayCalendarAlerts.length}</b>
                          <ChevronDown className={alertGroupsOpen.calendar ? "open" : ""} size={14} />
                        </button>
                        <AnimatePresence initial={false}>
                        {alertGroupsOpen.calendar && (
                          <motion.div
                            animate={{height: "auto", opacity: 1}}
                            exit={{height: 0, opacity: 0}}
                            initial={{height: 0, opacity: 0}}
                            transition={{duration: appSettings.animationsEnabled ? 0.18 : 0}}>
                        {todayCalendarAlerts.map((entry) => (
                          <div className="client-alert-row" key={entry.alertId}>
                            <button
                              className="client-alert-summary"
                              type="button"
                              onClick={() =>
                                setActiveClientAlertId((current) =>
                                  current === entry.alertId ? null : entry.alertId,
                                )
                              }>
                              <div>
                                <strong>{entry.time} · {entry.client}</strong>
                                <span>{entry.service} · {entry.master}</span>
                              </div>
                              <b>Сегодня</b>
                            </button>
                            {activeClientAlertId === entry.alertId && (
                              <div className="client-alert-actions">
                                <button type="button" onClick={() => remindCalendarClient(entry)}>
                                  <MessageSquareText size={14} />
                                  Написать
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePage("calendar");
                                    setClientAlertsOpen(false);
                                    setActiveClientAlertId(null);
                                  }}>
                                  <CalendarDays size={14} />
                                  Календарь
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDismissedClientAlertIds((current) => [
                                      ...current,
                                      entry.alertId,
                                    ]);
                                    setActiveClientAlertId(null);
                                  }}>
                                  <EyeOff size={14} />
                                  Скрыть
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                          </motion.div>
                        )}
                        </AnimatePresence>
                      </div>
                    )}
                    {inactiveClientAlerts.length > 0 && (
                      <div className="client-alert-group">
                        <button
                          className="client-alert-group-toggle"
                          type="button"
                          onClick={() =>
                            setAlertGroupsOpen((current) => ({
                              ...current,
                              inactive: !current.inactive,
                            }))
                          }>
                          Давно не были <b>{inactiveClientAlerts.length}</b>
                          <ChevronDown className={alertGroupsOpen.inactive ? "open" : ""} size={14} />
                        </button>
                        <AnimatePresence initial={false}>
                        {alertGroupsOpen.inactive && (
                          <motion.div
                            animate={{height: "auto", opacity: 1}}
                            exit={{height: 0, opacity: 0}}
                            initial={{height: 0, opacity: 0}}
                            transition={{duration: appSettings.animationsEnabled ? 0.18 : 0}}>
                      {inactiveClientAlerts.map((client) => (
                        <div
                          className={`client-alert-row ${
                            activeClientAlertId === client.alertId ? "active" : ""
                          }`}
                          key={client.alertId}>
                          <button
                            className="client-alert-summary"
                            type="button"
                            onClick={() =>
                              setActiveClientAlertId((current) =>
                                current === client.alertId ? null : client.alertId,
                              )
                            }>
                            <div>
                              <strong>{client.name}</strong>
                              <span>{client.phone || "Телефон не указан"}</span>
                            </div>
                            <b>
                              {client.daysAbsent === null
                                ? "Нет визитов"
                                : `${client.daysAbsent} дн.`}
                            </b>
                          </button>
                          {activeClientAlertId === client.alertId && (
                            <div className="client-alert-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreferredMessageClientId(String(client.id));
                                  setActivePage("templates");
                                  setClientAlertsOpen(false);
                                  setActiveClientAlertId(null);
                                }}>
                                <MessageSquareText size={14} />
                                Написать
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDismissedClientAlertIds((current) => [
                                    ...current,
                                    client.alertId,
                                  ]);
                                  setActiveClientAlertId(null);
                                }}>
                                <EyeOff size={14} />
                                Скрыть
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                        <button
                          className="secondary-button client-alert-category-action"
                          type="button"
                          onClick={() => {
                            setActivePage("clients");
                            setClientAlertsOpen(false);
                            setActiveClientAlertId(null);
                          }}>
                          Открыть клиентов
                        </button>
                          </motion.div>
                        )}
                        </AnimatePresence>
                      </div>
                    )}
                    {alertsCount === 0 && (
                      <p className="client-alert-empty">
                        Сейчас нет новых уведомлений.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        {isVisitsPage ? (
          <section className="visits-page-grid">
            <VisitsTable
              visits={filteredVisits}
              title="Все визиты"
              masters={masters}
              employees={employees}
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={resetFilters}
              onAddVisit={openCreateVisit}
              openActionMenuId={openActionMenuId}
              onToggleActionMenu={setOpenActionMenuId}
              onEditVisit={openEditVisit}
              onDeleteVisit={deleteVisit}
            />
          </section>
        ) : isCalendarPage ? (
          <CalendarPage
            entries={calendarEntries}
            visits={visits}
            clients={clientProfiles}
            clientPackages={clientPackages}
            employees={employees.filter((employee) => employee.status !== "Архив")}
            settings={appSettings}
            onAdd={openCreateCalendarEntry}
            onEdit={(entry) => requestCalendarAction("edit", entry)}
            onDelete={(entry) => requestCalendarAction("delete", entry)}
            onMove={moveCalendarEntry}
            onComplete={(entry) => requestCalendarAction("complete", entry)}
            onRemind={remindCalendarClient}
            onStatus={updateCalendarEntryStatus}
          />
        ) : isClientsPage ? (
          <ClientsPage
            visits={visits}
            clients={clientProfiles}
            clientPackages={clientPackages}
            communicationLog={communicationLog}
            employees={employees}
            inactiveClientDays={inactiveClientDays}
            onAddClient={openCreateClient}
            onEditClient={openEditClient}
            onDeleteClient={deleteClient}
            onMessageClient={openClientMessageTemplates}
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
            gmailClientId={appSettings.gmailClientId}
            importedMailIds={importedMailIds}
            services={serviceCatalog}
            onApply={applyMailImports}
            onNotify={pushNotification}
            onOpenSettings={() => setActivePage("settings")}
          />
        ) : isStatisticsPage ? (
          <StatisticsPage
            visits={visits}
            clientPackages={clientPackages}
            clients={clientProfiles}
            employees={employees}
          />
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
            visits={visits}
            clientPackages={clientPackages}
            clients={clientProfiles}
            employees={employees}
          />
        )}
      </main>
      {visitModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="visit-modal"
            role="dialog"
            aria-labelledby="visit-modal-title">
            <div className="modal-header">
              <h2 id="visit-modal-title">
                {editingVisit ? "Редактировать визит" : "Добавить визит"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setVisitModalOpen(false);
                  setEditingVisit(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <NewVisitForm
              clients={clientNames}
              clientPackages={clientPackages}
              masters={masters}
              services={serviceNames}
              initialVisit={editingVisit}
              onSubmit={handleVisitSubmit}
            />
          </section>
        </div>
      )}
      {employeeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal"
            role="dialog"
            aria-labelledby="employee-modal-title">
            <div className="modal-header">
              <h2 id="employee-modal-title">
                {editingEmployee
                  ? "Редактировать сотрудника"
                  : "Добавить сотрудника"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setEmployeeModalOpen(false);
                  setEditingEmployee(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <EmployeeForm
              employee={editingEmployee}
              onSubmit={handleEmployeeSubmit}
            />
          </section>
        </div>
      )}
      {clientModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal"
            role="dialog"
            aria-labelledby="client-modal-title">
            <div className="modal-header">
              <h2 id="client-modal-title">
                {editingClient ? "Редактировать клиента" : "Добавить клиента"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setClientModalOpen(false);
                  setEditingClient(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <NewClientForm client={editingClient} onSubmit={handleClientSubmit} />
          </section>
        </div>
      )}
      {serviceModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="service-modal-title">
            <div className="modal-header">
              <h2 id="service-modal-title">
                {editingService ? "Редактировать услугу" : "Добавить услугу"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setServiceModalOpen(false);
                  setEditingService(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <ServiceForm
              service={editingService}
              onSubmit={handleServiceSubmit}
            />
          </section>
        </div>
      )}
      {packageModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="package-modal-title">
            <div className="modal-header">
              <h2 id="package-modal-title">
                {editingPackage ? "Редактировать пакет" : "Добавить пакет"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setPackageModalOpen(false);
                  setEditingPackage(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <PackageForm
              packageItem={editingPackage}
              services={serviceNames}
              onSubmit={handlePackageSubmit}
            />
          </section>
        </div>
      )}
      {clientPackageModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="client-package-modal-title">
            <div className="modal-header">
              <h2 id="client-package-modal-title">
                {editingClientPackage
                  ? "Редактировать остаток"
                  : "Продать пакет клиенту"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setClientPackageModalOpen(false);
                  setEditingClientPackage(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <ClientPackageForm
              clients={clientNames}
              packages={packagesCatalog}
              clientPackage={editingClientPackage}
              onSubmit={handleClientPackageSubmit}
            />
          </section>
        </div>
      )}
      {messageTemplateModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal message-template-modal"
            role="dialog"
            aria-labelledby="message-template-modal-title">
            <div className="modal-header">
              <h2 id="message-template-modal-title">
                {editingMessageTemplate
                  ? "Редактировать шаблон"
                  : "Добавить шаблон"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setMessageTemplateModalOpen(false);
                  setEditingMessageTemplate(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <MessageTemplateForm
              template={editingMessageTemplate}
              onSubmit={handleMessageTemplateSubmit}
            />
          </section>
        </div>
      )}
      {calendarEntryModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal calendar-entry-modal"
            role="dialog"
            aria-labelledby="calendar-entry-modal-title">
            <div className="modal-header">
              <h2 id="calendar-entry-modal-title">
                {editingCalendarEntry ? "Редактировать запись" : "Добавить в календарь"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setCalendarEntryModalOpen(false);
                  setEditingCalendarEntry(null);
                  setCalendarEntryDefaults({});
                }}>
                <X size={18} />
              </button>
            </div>
            <CalendarEntryForm
              clients={clientProfiles}
              clientPackages={clientPackages}
              employees={employees.filter((employee) => employee.status !== "Архив")}
              initialEntry={editingCalendarEntry}
              selectedDate={calendarEntryDefaults.date ?? DEFAULT_STATS_DATE}
              selectedClient={calendarEntryDefaults.client ?? ""}
              selectedMaster={calendarEntryDefaults.master ?? masters[0] ?? ""}
              selectedTime={calendarEntryDefaults.time ?? "10:00"}
              services={serviceCatalog}
              onSubmit={handleCalendarEntrySubmit}
            />
          </section>
        </div>
      )}
      {taskModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="employee-modal catalog-modal" role="dialog" aria-labelledby="task-modal-title">
            <div className="modal-header">
              <h2 id="task-modal-title">{editingTask ? "Редактировать задачу" : "Новая задача"}</h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setTaskModalOpen(false);
                  setEditingTask(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <TaskForm task={editingTask} onSubmit={handleTaskSubmit} />
          </section>
        </div>
      )}
      {supplyModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="employee-modal catalog-modal" role="dialog" aria-labelledby="supply-modal-title">
            <div className="modal-header">
              <h2 id="supply-modal-title">{editingSupply ? "Редактировать расходник" : "Новый расходник"}</h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={() => {
                  setSupplyModalOpen(false);
                  setEditingSupply(null);
                }}>
                <X size={18} />
              </button>
            </div>
            <SupplyForm supply={editingSupply} onSubmit={handleSupplySubmit} />
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingVisit)}
        title="Сохранить визит?"
        message="Проверьте данные перед добавлением визита в журнал."
        confirmLabel="Сохранить"
        onCancel={() => setPendingVisit(null)}
        onConfirm={confirmVisitSave}
      />
      <ConfirmDialog
        open={Boolean(pendingCalendarAction)}
        title={
          pendingCalendarAction?.type === "complete"
            ? "Завершить визит?"
            : pendingCalendarAction?.type === "delete"
              ? "Удалить запись?"
              : "Редактировать запись?"
        }
        message={
          pendingCalendarAction?.type === "complete"
            ? "После завершения визит будет добавлен в журнал и учтен в статистике."
            : pendingCalendarAction?.type === "delete"
              ? "Запись исчезнет из календаря."
              : "Открыть форму и изменить данные записи?"
        }
        confirmLabel={
          pendingCalendarAction?.type === "complete"
            ? "Завершить"
            : pendingCalendarAction?.type === "delete"
              ? "Удалить"
              : "Редактировать"
        }
        onCancel={() => setPendingCalendarAction(null)}
        onConfirm={confirmCalendarAction}
      />
      <ConfirmDialog
        open={Boolean(pendingCalendarConflict)}
        title={pendingCalendarConflict?.shiftWarning ? "Проверьте время записи" : "Конфликт в календаре"}
        message={[
          pendingCalendarConflict?.shiftWarning,
          (pendingCalendarConflict?.conflicts.length ?? 0) > 0
            ? `У этого мастера уже есть ${pendingCalendarConflict.conflicts.length} пересекающихся записей.`
            : "",
          "Всё равно сохранить запись?",
        ].filter(Boolean).join(" ")}
        confirmLabel="Сохранить"
        onCancel={() => setPendingCalendarConflict(null)}
        onConfirm={confirmCalendarConflict}
      />
      <ConfirmDialog
        open={Boolean(pendingDataBackup)}
        title="Восстановить базу?"
        message="Текущие локальные данные будут заменены содержимым резервной копии."
        confirmLabel="Восстановить"
        onCancel={() => setPendingDataBackup(null)}
        onConfirm={confirmDataBackupImport}
      />
      <ToastStack notifications={notifications} onClose={closeNotification} />
    </div>
  );
}

export default App;
