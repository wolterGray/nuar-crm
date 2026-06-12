import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import AppGate from "./components/AppGate.jsx";
import AppShell from "./components/AppShell.jsx";
import AppNavigation from "./components/AppNavigation.jsx";
import NotificationDrawer from "./components/NotificationDrawer.jsx";
import AppModals from "./components/AppModals.jsx";
import ToastStack from "./components/ToastStack.jsx";
import {PageNotificationsProvider} from "./components/PageNotifications.jsx";
import "./styles/index.css";
import {
  getServiceColor,
  normalizeServiceColors,
  serviceColorPalette,
} from "./utils/serviceColors.js";
import AppRoutes from "./components/AppRoutes.jsx";
import {supabase} from "./lib/supabase.js";
import {publishServicesToSite} from "./utils/siteSync.js";
import {mobileNavItems, navItems} from "./constants/navigation.js";
import {
  ACTIVE_PAGE_STORAGE_KEY,
  ALERT_FILTER_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from "./constants/storageKeys.js";
import {
  DEFAULT_STATS_DATE,
  defaultAppSettings,
} from "./constants/appDefaults.js";
import {
  AUTO_COMPLETED_CALENDAR_IDS_STORAGE_KEY,
  getInitialCrmCollections,
  loadAlertSnoozes,
  loadCommunicationLog,
  loadDismissedClientAlerts,
  loadNotificationInbox,
  loadStoredAlertFilter,
  loadStoredActivePage,
  loadStoredCollection,
  loadStoredEmployees,
  loadStoredMessageTemplates,
  loadStoredPackages,
  loadStoredServices,
  loadStoredSettings,
  normalizeStoredSettings,
  IMPORT_DOCUMENTS_STORAGE_KEY,
  IMPORTED_MAIL_IDS_STORAGE_KEY,
  SUPPLIES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
} from "./utils/crmStorage.js";
import {buildPaymentRows, filterPaymentRows} from "./utils/paymentRows.js";
import {buildEmployeeStats} from "./utils/employeeStats.js";
import {applyBooksySources} from "./utils/booksySources.js";
import {openSupplyOrderUrl} from "./utils/supplyOrder.js";
import {resolveClientPackageStatus} from "./utils/clientPackages.js";
import {resolveColorTheme} from "./utils/colorTheme.js";
import {applyCrmSnapshot, buildCloudSnapshot} from "./utils/cloudSnapshot.js";
import {useCloudSync} from "./hooks/useCloudSync.js";
import {useCloudSaveActions} from "./hooks/useCloudSaveActions.js";
import {useDataBackup} from "./hooks/useDataBackup.js";
import {useEntityDelete} from "./hooks/useEntityDelete.js";
import {useAppSettingsHandlers} from "./hooks/useAppSettingsHandlers.js";
import {useFinancialOperations} from "./hooks/useFinancialOperations.js";
import {usePaymentJournal} from "./hooks/usePaymentJournal.js";
import {useCalendarActions} from "./hooks/useCalendarActions.js";
import {useEmployeeHandlers} from "./hooks/useEmployeeHandlers.js";
import {useClientHandlers} from "./hooks/useClientHandlers.js";
import {useServiceHandlers} from "./hooks/useServiceHandlers.js";
import {useMessageTemplateHandlers} from "./hooks/useMessageTemplateHandlers.js";
import {useTaskHandlers} from "./hooks/useTaskHandlers.js";
import {useSupplyHandlers} from "./hooks/useSupplyHandlers.js";
import {useMailImport} from "./hooks/useMailImport.js";
import {useBooksyGmailSync} from "./hooks/useBooksyGmailSync.js";
import {useToastNotifications} from "./hooks/useToastNotifications.js";
import {useAuth} from "./hooks/useAuth.js";
import {useClientAlerts} from "./hooks/useClientAlerts.js";
import {useCrmLocalPersistence} from "./hooks/useCrmLocalPersistence.js";
import {useModalScrollLock} from "./hooks/useModalScrollLock.js";
import {useCommunicationLog} from "./hooks/useCommunicationLog.js";
import {usePullRefresh} from "./hooks/usePullRefresh.js";
import {usePersistentState} from "./hooks/usePersistentState.js";
let localIdSequence = 0;
const createLocalId = () => Date.now() * 1000 + ++localIdSequence;
function App() {
  const [visits, setVisits] = useState(() => getInitialCrmCollections().visits);
  const [employees, setEmployees] = useState(loadStoredEmployees);
  const [clientProfiles, setClientProfiles] = useState(
    () => getInitialCrmCollections().clients,
  );
  const [serviceCatalog, setServiceCatalog] = useState(loadStoredServices);
  const [packagesCatalog, setPackagesCatalog] = useState(loadStoredPackages);
  const [clientPackages, setClientPackages] = useState(
    () => getInitialCrmCollections().clientPackages,
  );
  const [messageTemplates, setMessageTemplates] = useState(
    loadStoredMessageTemplates,
  );
  const [calendarEntries, setCalendarEntries] = useState(
    () => getInitialCrmCollections().calendarEntries,
  );
  const [dismissedClientAlertIds, setDismissedClientAlertIds] = useState(
    loadDismissedClientAlerts,
  );
  const [alertSnoozes, setAlertSnoozes] = useState(loadAlertSnoozes);
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
  const [activePage, setActivePage] = usePersistentState(
    ACTIVE_PAGE_STORAGE_KEY,
    loadStoredActivePage,
    {
      deserialize: (value) => {
        const pageExists =
          navItems.some((item) => item.page === value) || value === "site";
        return pageExists && value !== "home" ? value : "calendar";
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
  const [editingFinancialOperation, setEditingFinancialOperation] = useState(null);
  const [editingJournalVisit, setEditingJournalVisit] = useState(null);
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
  const [clientAlertsOpen, setClientAlertsOpen] = useState(false);
  const [alertFilter, setAlertFilter] = useState(loadStoredAlertFilter);
  const [alertFocus, setAlertFocus] = useState(null);
  const [notificationSlot, setNotificationSlot] = useState(null);
  const [, setActiveClientAlertId] = useState(null);
  const [preferredMessageClientId, setPreferredMessageClientId] = useState("");
  const contentRef = useRef(null);
  const autoCompletedCalendarEntryIdsRef = useRef(
    new Set(autoCompletedCalendarEntryIds),
  );
  const cloudSnapshotRef = useRef(null);
  const lastPublishedServicesRef = useRef("");
  const onSessionLostRef = useRef(() => {});

  const {closeNotification, notifications, pushNotification, pushNotificationRef} =
    useToastNotifications({
      createLocalId,
      setNotificationInbox,
    });

  const {
    authReady,
    authSession,
    handleGoogleLogin,
    handleLogin,
    handleLogout,
    handleResetPassword,
    handleUpdatePassword,
    passwordRecovery,
  } = useAuth({
    onSessionLostRef,
    pushNotification,
    supabase,
  });

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

  const pullRefreshBlocked =
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
    clientAlertsOpen;

  const {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    pullRefresh,
  } = usePullRefresh({
    contentRef,
    isBlocked: pullRefreshBlocked,
  });

  const {
    alertSummary,
    alerts,
    alertsCount,
    dismissAlertPermanent,
    openClientMessageTemplates,
    quietHoursActive,
    snoozeAlertDays,
    snoozeAlertToday,
    snoozeAlertWeek,
    totalAlertsCount,
    undoNotificationAction,
    urgentAlertsCount,
  } = useClientAlerts({
    alertFilter,
    alertSnoozes,
    appSettings,
    calendarEntries,
    clientPackages,
    clientProfiles,
    defaultAppSettings,
    dismissedClientAlertIds,
    inactiveClientDays,
    notificationInbox,
    pushNotification,
    setActiveClientAlertId,
    setActivePage,
    setAlertSnoozes,
    setClientAlertsOpen,
    setClientPackages,
    setDismissedClientAlertIds,
    setNotificationInbox,
    setPackagesCatalog,
    setPreferredMessageClientId,
    supplies,
    tasks,
    visits,
  });

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
    () => buildPaymentRows(calendarEntries, visits),
    [calendarEntries, visits],
  );

  const filteredPaymentRows = useMemo(
    () => filterPaymentRows(paymentRows, paymentFilters),
    [paymentFilters, paymentRows],
  );

  useEffect(() => {
    window.localStorage.setItem(ALERT_FILTER_STORAGE_KEY, alertFilter);
  }, [alertFilter]);

  useCrmLocalPersistence({
    alertSnoozes,
    appSettings,
    autoCompletedCalendarEntryIds,
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
  });

  useModalScrollLock(
    employeeModalOpen ||
      clientModalOpen ||
      serviceModalOpen ||
      packageModalOpen ||
      clientPackageModalOpen ||
      messageTemplateModalOpen ||
      calendarEntryModalOpen ||
      taskModalOpen ||
      supplyModalOpen ||
      financialOperationModalOpen,
  );

  const cloudSnapshot = useMemo(
    () =>
      buildCloudSnapshot({
        alertSnoozes,
        appSettings,
        autoCompletedCalendarEntryIds,
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
      }),
    [
      alertSnoozes,
      appSettings,
      autoCompletedCalendarEntryIds,
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

  const applyCloudSnapshot = useCallback(
    (snapshot) => {
      applyCrmSnapshot(snapshot, {
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
        setEmployees,
        setImportDocuments,
        setImportedMailIds,
        setMessageTemplates,
        setNotificationInbox,
        setPackagesCatalog,
        setServiceCatalog,
        setSupplies,
        setTasks,
        setVisits,
      });
    },
    [setAppSettings],
  );

  const {
    applyRemoteSnapshot,
    cloudConflict,
    cloudHydrated,
    cloudLoadError,
    cloudSyncing,
    forceCloudSave,
    lastCloudSyncAt,
    lastCloudSyncError,
    overwriteRemoteSnapshot,
    resetCloudSyncState,
  } = useCloudSync({
    supabase,
    userId: authSession?.user?.id,
    cloudSnapshot,
    cloudSnapshotRef,
    onApplySnapshot: applyCloudSnapshot,
    onConflictDetected: () => {
      pushNotificationRef.current({
        message: "Откройте Настройки → Облако, чтобы выбрать версию данных.",
        persist: true,
        title: "Конфликт синхронизации",
      });
    },
  });

  useEffect(() => {
    onSessionLostRef.current = resetCloudSyncState;
  }, [resetCloudSyncState]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!supabase || !userId || !cloudHydrated) return undefined;

    const servicesKey = JSON.stringify(serviceCatalog);
    if (lastPublishedServicesRef.current === servicesKey) return undefined;

    const timer = window.setTimeout(async () => {
      try {
        await publishServicesToSite(serviceCatalog);
        lastPublishedServicesRef.current = servicesKey;
      } catch (error) {
        pushNotificationRef.current({
          title: "Цены на сайт не обновились",
          message:
            error?.message ||
            "Не удалось синхронизировать каталог услуг с nuarr.pl",
        });
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [authSession?.user?.id, cloudHydrated, serviceCatalog]);

  const employeeStats = useMemo(
    () => buildEmployeeStats(employees, visits),
    [employees, visits],
  );

  const backupCollections = useMemo(
    () => ({
      calendarEntries,
      clientPackages,
      alertSnoozes,
      clients: clientProfiles,
      communicationLog,
      dismissedClientAlertIds,
      employees,
      importDocuments,
      importedMailIds,
      messageTemplates,
      notificationInbox,
      packages: packagesCatalog,
      services: serviceCatalog,
      settings: appSettings,
      supplies,
      tasks,
      visits,
    }),
    [
      appSettings,
      alertSnoozes,
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

  const backupSetters = useMemo(
    () => ({
      setAppSettings,
      setCalendarEntries,
      setClientPackages,
      setClientProfiles,
      setCommunicationLog,
      setDismissedClientAlertIds,
      setAlertSnoozes,
      setEmployees,
      setImportDocuments,
      setImportedMailIds,
      setMessageTemplates,
      setNotificationInbox,
      setPackagesCatalog,
      setServiceCatalog,
      setSupplies,
      setTasks,
      setVisits,
    }),
    [
      setAppSettings,
      setCalendarEntries,
      setClientPackages,
      setClientProfiles,
      setCommunicationLog,
      setDismissedClientAlertIds,
      setAlertSnoozes,
      setEmployees,
      setImportDocuments,
      setImportedMailIds,
      setMessageTemplates,
      setNotificationInbox,
      setPackagesCatalog,
      setServiceCatalog,
      setSupplies,
      setTasks,
      setVisits,
    ],
  );

  const {
    cancelDataBackupImport,
    confirmDataBackupImport,
    exportDataBackup,
    importDataBackup,
    pendingDataBackup,
  } = useDataBackup({
    collections: backupCollections,
    defaultAppSettings,
    pushNotification,
    setters: backupSetters,
  });

  const {handleSettingsSubmit, resetSettings} = useAppSettingsHandlers({
    appSettings,
    defaultAppSettings,
    pushNotification,
    setAppSettings,
  });

  const {
    handleApplyRemoteSnapshot,
    handleForceCloudSave,
    handleOverwriteRemoteSnapshot,
  } = useCloudSaveActions({
    applyRemoteSnapshot,
    forceCloudSave,
    overwriteRemoteSnapshot,
    pushNotification,
  });

  const entityDeleteHandlersRef = useRef({});
  const {
    cancelEntityDelete,
    confirmEntityDelete,
    pendingEntityDelete,
    requestEntityDelete,
  } = useEntityDelete({
    onConfirmDelete: ({type, entity}) => {
      entityDeleteHandlersRef.current[type]?.(entity);
    },
  });

  const updatePackageBalance = useCallback((previousVisit, nextVisit) => {
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
          status: resolveClientPackageStatus(
            Math.min(restored, packageItem.totalVisits),
            packageItem.status,
          ),
        };
      });

      return restorePrevious.map((packageItem) => {
        if (packageItem.id !== nextVisit?.packageUsageId) {
          return packageItem;
        }

        const used = Number(nextVisit.packageSessionsUsed) || 0;
        const nextRemaining = Math.max(0, packageItem.remainingVisits - used);

        return {
          ...packageItem,
          remainingVisits: nextRemaining,
          status: resolveClientPackageStatus(nextRemaining, packageItem.status),
        };
      });
    });
  }, [setClientPackages]);

  const {
    cancelCalendarAction,
    cancelCalendarConflict,
    confirmCalendarAction,
    confirmCalendarConflict,
    handleCalendarEntrySubmit,
    moveCalendarEntry,
    openCreateCalendarEntry,
    openEditCalendarEntry,
    pendingCalendarAction,
    pendingCalendarConflict,
    remindCalendarClient,
    repeatClientVisit,
    requestCalendarAction,
    updateCalendarEntryStatus,
  } = useCalendarActions({
    appSettings,
    autoCompletedCalendarEntryIdsRef,
    calendarEntries,
    clientPackages,
    clientProfiles,
    createLocalId,
    editingCalendarEntry,
    editingJournalVisit,
    employees,
    getCalendarServiceColor,
    pushNotification,
    serviceCatalog,
    setActiveClientAlertId,
    setActivePage,
    setAutoCompletedCalendarEntryIds,
    setCalendarEntries,
    setCalendarEntryDefaults,
    setCalendarEntryModalOpen,
    setClientAlertsOpen,
    setEditingCalendarEntry,
    setEditingJournalVisit,
    setPreferredMessageClientId,
    setVisits,
    updatePackageBalance,
    visits,
  });

  const {handleFinancialOperationSubmit} = useFinancialOperations({
    clientProfiles,
    createLocalId,
    editingFinancialOperation,
    pushNotification,
    setEditingFinancialOperation,
    setFinancialOperationModalOpen,
    setVisits,
  });

  const {
    cancelPaymentDelete,
    confirmPaymentDelete,
    deletePaymentRow,
    editPaymentRow,
    pendingPaymentDelete,
  } = usePaymentJournal({
    calendarEntries,
    clientProfiles,
    openEditCalendarEntry,
    pushNotification,
    serviceCatalog,
    setCalendarEntries,
    setCalendarEntryDefaults,
    setCalendarEntryModalOpen,
    setEditingCalendarEntry,
    setEditingFinancialOperation,
    setEditingJournalVisit,
    setFinancialOperationModalOpen,
    setOpenPaymentActionMenuId,
    setVisits,
    updatePackageBalance,
    visits,
  });

  const {
    handleEmployeeSubmit,
    openCreateEmployee,
    openEditEmployee,
    performDeleteEmployee,
    requestDeleteEmployee,
  } = useEmployeeHandlers({
    createLocalId,
    editingEmployee,
    pushNotification,
    requestEntityDelete,
    setCalendarEntries,
    setEditingEmployee,
    setEmployeeModalOpen,
    setEmployees,
    setVisits,
  });

  const {
    addCalendarFormClient,
    addClientCalendarVisit,
    handleClientPackageSubmit,
    handleClientSubmit,
    openCreateClient,
    openCreateClientPackage,
    openEditClient,
    openEditClientPackage,
    performDeleteClient,
    performDeleteClientPackage,
    requestDeleteClient,
    requestDeleteClientPackage,
    updateClientNote,
  } = useClientHandlers({
    clientProfiles,
    createLocalId,
    editingClient,
    editingClientPackage,
    openCreateCalendarEntry,
    packagesCatalog,
    pushNotification,
    requestEntityDelete,
    setActivePage,
    setCalendarEntries,
    setClientModalOpen,
    setClientPackageModalOpen,
    setClientPackages,
    setClientProfiles,
    setEditingClient,
    setEditingClientPackage,
    setVisits,
  });

  const {
    handlePackageSubmit,
    handleServiceSubmit,
    openCreatePackage,
    openCreateService,
    openEditPackage,
    openEditService,
    performDeletePackage,
    performDeleteService,
    requestDeletePackage,
    requestDeleteService,
  } = useServiceHandlers({
    createLocalId,
    editingPackage,
    editingService,
    pushNotification,
    requestEntityDelete,
    setCalendarEntries,
    setClientPackages,
    setEditingPackage,
    setEditingService,
    setPackageModalOpen,
    setPackagesCatalog,
    setServiceCatalog,
    setServiceModalOpen,
    setVisits,
  });

  const {
    handleMessageTemplateSubmit,
    openCreateMessageTemplate,
    openEditMessageTemplate,
    performDeleteMessageTemplate,
    requestDeleteMessageTemplate,
  } = useMessageTemplateHandlers({
    createLocalId,
    editingMessageTemplate,
    pushNotification,
    requestEntityDelete,
    setEditingMessageTemplate,
    setMessageTemplateModalOpen,
    setMessageTemplates,
  });

  const {
    addQuickNote,
    completeTask,
    handleTaskSubmit,
    openCreateTask,
    openEditTask,
    performDeleteTask,
    reorderTasks,
    requestDeleteTask,
  } = useTaskHandlers({
    createLocalId,
    editingTask,
    pushNotification,
    requestEntityDelete,
    setEditingTask,
    setTaskModalOpen,
    setTasks,
  });

  const {
    changeSupplyStock,
    handleSupplySubmit,
    openCreateSupply,
    openEditSupply,
    performDeleteSupply,
    requestDeleteSupply,
  } = useSupplyHandlers({
    createLocalId,
    editingSupply,
    pushNotification,
    requestEntityDelete,
    setEditingSupply,
    setSupplies,
    setSupplyModalOpen,
  });

  const clearAlertFocus = useCallback(() => {
    setAlertFocus(null);
  }, []);

  const resolveAlertClient = useCallback(
    (alert) => {
      if (alert.meta?.client) {
        return alert.meta.client;
      }

      if (alert.meta?.entry) {
        return clientProfiles.find(
          (item) =>
            (alert.meta.entry.clientId &&
              String(item.id) === String(alert.meta.entry.clientId)) ||
            item.name === alert.meta.entry.client,
        );
      }

      return clientProfiles.find(
        (item) =>
          String(item.id) === String(alert.entityId) ||
          item.name === alert.entityId,
      );
    },
    [clientProfiles],
  );

  const navigateFromAlert = useCallback(
    (alert) => {
      if (alert.type === "aggregate") {
        const focusChild =
          alert.children.find((child) => child.priority === "critical") ??
          alert.children[0];

        setActivePage(alert.page);
        setAlertFocus({
          entityId: focusChild?.entityId,
          section: alert.section,
          type: focusChild?.type ?? alert.aggregateKind,
        });
        setClientAlertsOpen(false);
        setActiveClientAlertId(null);
        return;
      }

      setActivePage(alert.page);
      setAlertFocus({
        entityId: alert.entityId,
        section: alert.section,
        type: alert.type,
      });
      setClientAlertsOpen(false);
      setActiveClientAlertId(null);
    },
    [setActivePage],
  );

  const handleAlertAction = useCallback(
    (alert, action) => {
      switch (action) {
        case "complete":
          if (alert.meta?.task) {
            completeTask(alert.meta.task);
          }
          break;
        case "open":
          navigateFromAlert(alert);
          break;
        case "order":
          if (alert.meta?.item?.orderUrl) {
            openSupplyOrderUrl(alert.meta.item.orderUrl);
            snoozeAlertToday(alert);
          }
          break;
        case "stock":
          if (alert.meta?.item) {
            changeSupplyStock(alert.meta.item, 1);
          }
          break;
        case "write": {
          const client = resolveAlertClient(alert);

          if (client) {
            openClientMessageTemplates(client);

            if (alert.type === "inactive") {
              snoozeAlertDays(alert, 14);
            }
          }
          break;
        }
        case "calendar":
          setActivePage("calendar");
          setAlertFocus({
            entityId: alert.meta?.entry?.id ?? alert.entityId,
            type: "calendar",
          });
          setClientAlertsOpen(false);
          setActiveClientAlertId(null);
          break;
        case "client": {
          const client = resolveAlertClient(alert);
          setActivePage("clients");
          setAlertFocus({
            entityId: client?.id ?? alert.entityId,
            type: "client",
          });
          setClientAlertsOpen(false);
          setActiveClientAlertId(null);
          break;
        }
        case "undo":
          if (alert.meta?.notification) {
            undoNotificationAction(alert.meta.notification);
          }
          break;
        case "dismiss":
          if (alert.meta?.notification) {
            setNotificationInbox((current) =>
              current.filter((item) => item.id !== alert.meta.notification.id),
            );
          }
          break;
        default:
          break;
      }
    },
    [
      changeSupplyStock,
      completeTask,
      navigateFromAlert,
      openClientMessageTemplates,
      resolveAlertClient,
      snoozeAlertDays,
      snoozeAlertToday,
      undoNotificationAction,
    ],
  );

  const handleToastAction = useCallback(
    (notification, actionItem) => {
      if (actionItem.action === "calendar") {
        setActivePage("calendar");
        setAlertFocus({
          entityId: actionItem.entityId ?? notification.meta?.entry?.id,
          type: "calendar",
        });
      } else if (actionItem.action === "write") {
        const client = clientProfiles.find(
          (item) =>
            String(item.id) === String(actionItem.entityId) ||
            item.name === actionItem.entityId ||
            item.name === notification.meta?.entry?.client,
        );

        if (client) {
          openClientMessageTemplates(client);
        }
      }

      closeNotification(notification.id);
    },
    [clientProfiles, closeNotification, openClientMessageTemplates, setActivePage],
  );

  const {applyMailImports} = useMailImport({
    calendarEntries,
    clientProfiles,
    createLocalId,
    getCalendarServiceColor,
    importDocuments,
    pushNotification,
    setCalendarEntries,
    setClientProfiles,
    setImportDocuments,
    setImportedMailIds,
  });

  const booksyGmailSync = useBooksyGmailSync({
    calendarEntries,
    clientProfiles,
    createLocalId,
    employees,
    getCalendarServiceColor,
    gmailAccessToken: authSession?.provider_token ?? "",
    gmailClientId: appSettings.gmailClientId,
    googleEmail: authSession?.user?.email ?? "",
    onGoogleLogin: handleGoogleLogin,
    processedMessageIds: importedMailIds,
    pushNotification,
    services: serviceCatalog,
    setCalendarEntries,
    setClientProfiles,
    setProcessedMessageIds: setImportedMailIds,
  });

  const {logClientMessage} = useCommunicationLog({
    createLocalId,
    pushNotification,
    setCommunicationLog,
  });

  useEffect(() => {
    entityDeleteHandlersRef.current = {
      client: performDeleteClient,
      clientPackage: performDeleteClientPackage,
      employee: performDeleteEmployee,
      messageTemplate: performDeleteMessageTemplate,
      package: performDeletePackage,
      service: performDeleteService,
      supply: performDeleteSupply,
      task: performDeleteTask,
    };
  });

  const isCalendarPage = activePage === "calendar";
  const isPaymentsPage = activePage === "payments";
  const colorTheme = resolveColorTheme(appSettings);
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== "Архив"),
    [employees],
  );
  const certificateVisits = useMemo(
    () =>
      visits.filter(
        (visit) =>
          visit.recordType === "operation" &&
          visit.service === "Продажа сертификата",
      ),
    [visits],
  );
  return (
    <AppGate
      appSettings={appSettings}
      authReady={authReady}
      authSession={authSession}
      closeNotification={closeNotification}
      cloudHydrated={cloudHydrated}
      cloudLoadError={cloudLoadError}
      handleGoogleLogin={handleGoogleLogin}
      handleLogin={handleLogin}
      handleLogout={handleLogout}
      handleResetPassword={handleResetPassword}
      handleUpdatePassword={handleUpdatePassword}
      notifications={notifications}
      passwordRecovery={passwordRecovery}>
    <AppShell
      compactMode={appSettings.compactMode}
      contentRef={contentRef}
      isCalendarPage={isCalendarPage}
      isPaymentsPage={isPaymentsPage}
      navigation={
        <AppNavigation
          activePage={activePage}
          mobileNavItems={mobileNavItems}
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
      theme={colorTheme.mode}
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
            editingFinancialOperation={editingFinancialOperation}
            editingJournalVisit={editingJournalVisit}
            financialOperationModalOpen={financialOperationModalOpen}
            masters={masters}
            messageTemplateModalOpen={messageTemplateModalOpen}
            packageModalOpen={packageModalOpen}
            packagesCatalog={packagesCatalog}
            paymentRows={paymentRows}
            pendingCalendarAction={pendingCalendarAction}
            pendingCalendarConflict={pendingCalendarConflict}
            pendingDataBackup={pendingDataBackup}
            pendingEntityDelete={pendingEntityDelete}
            pendingPaymentDelete={pendingPaymentDelete}
            serviceCatalog={serviceCatalog}
            serviceModalOpen={serviceModalOpen}
            serviceNames={serviceNames}
            supplyModalOpen={supplyModalOpen}
            taskModalOpen={taskModalOpen}
            onCalendarEntrySubmit={handleCalendarEntrySubmit}
            onCancelCalendarAction={cancelCalendarAction}
            onCancelCalendarConflict={cancelCalendarConflict}
            onCancelDataBackup={cancelDataBackupImport}
            onCancelEntityDelete={cancelEntityDelete}
            onCancelPaymentDelete={cancelPaymentDelete}
            onClientPackageSubmit={handleClientPackageSubmit}
            onClientSubmit={handleClientSubmit}
            onCloseCalendarEntryModal={() => {
              setCalendarEntryModalOpen(false);
              setEditingCalendarEntry(null);
              setEditingJournalVisit(null);
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
            onCloseFinancialOperationModal={() => {
              setFinancialOperationModalOpen(false);
              setEditingFinancialOperation(null);
            }}
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
            onConfirmEntityDelete={confirmEntityDelete}
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
          <ToastStack
            notifications={notifications}
            onAction={handleToastAction}
            onClose={closeNotification}
          />
        </>
      }>
        {notificationSlot &&
          createPortal(
            <NotificationDrawer
              alertFilter={alertFilter}
              alertSummary={alertSummary}
              alerts={alerts}
              alertsCount={alertsCount}
              animationsEnabled={appSettings.animationsEnabled}
              isOpen={clientAlertsOpen}
              totalAlertsCount={totalAlertsCount}
              urgentAlertsCount={urgentAlertsCount}
              quietHoursActive={quietHoursActive}
              theme={colorTheme.mode}
              onAction={handleAlertAction}
              onDismissPermanent={dismissAlertPermanent}
              onFilterChange={setAlertFilter}
              onSnoozeToday={snoozeAlertToday}
              onSnoozeWeek={snoozeAlertWeek}
              onToggleOpen={() => setClientAlertsOpen((current) => !current)}
            />,
            notificationSlot,
          )}
        <PageNotificationsProvider onSlotChange={setNotificationSlot}>
          <AppRoutes
            activePage={activePage}
            alertFocus={alertFocus}
            activeEmployees={activeEmployees}
            addClientCalendarVisit={addClientCalendarVisit}
            addQuickNote={addQuickNote}
            appSettings={appSettings}
            applyMailImports={applyMailImports}
            booksyGmailSync={booksyGmailSync}
            calendarEntries={calendarEntries}
            calendarEntriesWithServiceColors={calendarEntriesWithServiceColors}
            calendarEntryModalOpen={calendarEntryModalOpen}
            certificateVisits={certificateVisits}
            changeSupplyStock={changeSupplyStock}
            clearAlertFocus={clearAlertFocus}
            clearPreferredMessageClientId={() => setPreferredMessageClientId("")}
            clientPackages={clientPackages}
            clientProfiles={clientProfiles}
            cloudConflict={cloudConflict}
            cloudEnabled={Boolean(supabase && authSession?.user?.id)}
            cloudHydrated={cloudHydrated}
            cloudLoadError={cloudLoadError}
            cloudSyncing={cloudSyncing}
            communicationLog={communicationLog}
            completeTask={completeTask}
            deletePaymentRow={deletePaymentRow}
            editPaymentRow={editPaymentRow}
            employeeStats={employeeStats}
            employees={employees}
            exportDataBackup={exportDataBackup}
            filteredPaymentRows={filteredPaymentRows}
            gmailAccessToken={authSession?.provider_token ?? ""}
            handleApplyRemoteSnapshot={handleApplyRemoteSnapshot}
            handleForceCloudSave={handleForceCloudSave}
            handleGoogleLogin={handleGoogleLogin}
            handleOverwriteRemoteSnapshot={handleOverwriteRemoteSnapshot}
            handleSettingsSubmit={handleSettingsSubmit}
            importDataBackup={importDataBackup}
            importDocuments={importDocuments}
            importedMailIds={importedMailIds}
            inactiveClientDays={inactiveClientDays}
            lastCloudSyncAt={lastCloudSyncAt}
            lastCloudSyncError={lastCloudSyncError}
            logClientMessage={logClientMessage}
            masters={masters}
            messageTemplates={messageTemplates}
            moveCalendarEntry={moveCalendarEntry}
            openClientMessageTemplates={openClientMessageTemplates}
            openCreateCalendarEntry={openCreateCalendarEntry}
            openCreateClient={openCreateClient}
            openCreateClientPackage={openCreateClientPackage}
            openCreateEmployee={openCreateEmployee}
            openCreateMessageTemplate={openCreateMessageTemplate}
            openCreatePackage={openCreatePackage}
            openCreatePayment={() => {
              setEditingFinancialOperation(null);
              setFinancialOperationModalOpen(true);
            }}
            openCreateService={openCreateService}
            openCreateSupply={openCreateSupply}
            openCreateTask={openCreateTask}
            openEditClient={openEditClient}
            openEditClientPackage={openEditClientPackage}
            openEditEmployee={openEditEmployee}
            openEditMessageTemplate={openEditMessageTemplate}
            openEditPackage={openEditPackage}
            openEditService={openEditService}
            openEditSupply={openEditSupply}
            openEditTask={openEditTask}
            openSettingsPage={() => setActivePage("settings")}
            packageSalesIncome={packageSalesIncome}
            packagesCatalog={packagesCatalog}
            paymentFilters={paymentFilters}
            paymentRows={paymentRows}
            preferredMessageClientId={preferredMessageClientId}
            pushNotification={pushNotification}
            remindCalendarClient={remindCalendarClient}
            reorderTasks={reorderTasks}
            repeatClientVisit={repeatClientVisit}
            requestCalendarAction={requestCalendarAction}
            requestDeleteClient={requestDeleteClient}
            requestDeleteClientPackage={requestDeleteClientPackage}
            requestDeleteEmployee={requestDeleteEmployee}
            requestDeleteMessageTemplate={requestDeleteMessageTemplate}
            requestDeletePackage={requestDeletePackage}
            requestDeleteService={requestDeleteService}
            requestDeleteSupply={requestDeleteSupply}
            requestDeleteTask={requestDeleteTask}
            resetSettings={resetSettings}
            serviceCatalog={serviceCatalog}
            setOpenPaymentActionMenuId={setOpenPaymentActionMenuId}
            supplies={supplies}
            tasks={tasks}
            updateCalendarEntryStatus={updateCalendarEntryStatus}
            updateClientNote={updateClientNote}
            visits={visits}
            onPaymentFilterChange={(key, value) =>
              setPaymentFilters((current) => ({...current, [key]: value}))
            }
            onPaymentFiltersReset={() =>
              setPaymentFilters({master: "", payment: "", client: "", date: ""})
            }
            openPaymentActionMenuId={openPaymentActionMenuId}
          />
        </PageNotificationsProvider>
    </AppShell>
    </AppGate>
  );
}

export default App;
