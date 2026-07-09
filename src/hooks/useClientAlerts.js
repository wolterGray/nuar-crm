import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  fetchNotificationEvents,
  generateNotificationEvents,
  updateNotificationEvent,
} from "../api/notificationEvents.js";
import {buildAlertCenter, filterAlertsByMode} from "../utils/alertCenter.js";
import {getAggregateChildIds} from "../utils/alertAggregation.js";
import {
  getEndOfToday,
  getSnoozeUntilDays,
  pruneExpiredSnoozes,
} from "../utils/alertSnooze.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {
  applyQuietHoursFilter,
  isQuietHours,
  shouldShowSmartVisitPopup,
} from "../utils/quietHours.js";

const resolveAlertIds = (alertOrId) => {
  if (Array.isArray(alertOrId)) {
    return alertOrId;
  }

  if (typeof alertOrId === "string") {
    return [alertOrId];
  }

  if (alertOrId?.type === "aggregate") {
    return getAggregateChildIds(alertOrId);
  }

  return alertOrId?.id ? [alertOrId.id] : [];
};

const SERVER_ALERT_PREFIX = "server-notification-";

const isServerAlertId = (id) => String(id ?? "").startsWith(SERVER_ALERT_PREFIX);

const getServerEventId = (id) => Number(String(id).replace(SERVER_ALERT_PREFIX, ""));

const getServerAlertPage = (event) => {
  if (event.entityType === "calendar_entry" || event.type === "visit_upcoming") return "calendar";
  if (event.entityType === "task" || event.type === "task_due") return "operations";
  if (event.entityType === "supply" || event.type === "supply_low_stock") return "operations";
  if (event.entityType === "waitlist_entry" || event.type === "waitlist_active") return "operations";
  if (event.entityType === "client_package" || event.type === "package_ending") return "packages";
  if (event.entityType === "certificate" || event.type?.startsWith("certificate_")) return "payments";
  return "clients";
};

const getServerAlertType = (event) => {
  if (event.type === "task_due") return "task";
  if (event.type === "supply_low_stock") return "supply";
  if (event.type === "package_ending") return "package";
  if (event.type?.startsWith("certificate_")) return "package";
  if (event.type === "waitlist_active") return "task";
  if (event.type === "visit_upcoming") return "visit";
  return "inactive";
};

const getServerAlertGroup = (event) => {
  if (event.type === "visit_upcoming") return "calendar";
  if (event.type === "task_due" || event.type === "supply_low_stock" || event.type === "waitlist_active") return "operations";
  if (event.type === "package_ending" || event.type?.startsWith("certificate_")) return "packages";
  return "inactive";
};

const getServerAlertPriority = (event) => {
  if (event.priority === "critical") return "critical";
  if (event.priority === "high" || Number(event.score) >= 70) return "action";
  return "info";
};

const getServerAlertActions = (event) => {
  if (event.recommendedAction === "contact_client" || event.recommendedAction === "offer_package") {
    return ["write", "open", "snooze"];
  }
  if (event.recommendedAction === "open_calendar") return ["calendar", "snooze"];
  if (event.recommendedAction === "order_supply") return ["order", "open", "snooze"];
  return ["open", "snooze"];
};

const mapServerEventToAlert = (event) => ({
  actions: getServerAlertActions(event),
  entityId: event.clientId ?? event.entityId,
  group: getServerAlertGroup(event),
  id: `${SERVER_ALERT_PREFIX}${event.id}`,
  message: event.message,
  meta: {
    serverEvent: event,
    client: event.clientId ? {id: event.clientId, name: event.clientName} : null,
    entry:
      event.entityType === "calendar_entry"
        ? {
            id: event.entityId,
            client: event.clientName,
            clientId: event.clientId,
          }
        : null,
    item: event.payload,
  },
  page: getServerAlertPage(event),
  priority: getServerAlertPriority(event),
  section: event.entityType,
  title: event.title,
  type: getServerAlertType(event),
});

export function useClientAlerts({
  alertFilter = "all",
  alertSnoozes,
  appSettings,
  calendarEntries,
  certificates,
  clientAlertsOpen,
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
  setCertificates,
  setDismissedClientAlertIds,
  setNotificationInbox,
  setPackagesCatalog,
  setPreferredMessageClientId,
  supplies,
  tasks,
  visits,
}) {
  const smartVisitAlertIds = useRef(new Set());
  const [serverEvents, setServerEvents] = useState([]);
  const [serverConnected, setServerConnected] = useState(false);

  useEffect(() => {
    setAlertSnoozes((current) => pruneExpiredSnoozes(current));
  }, [setAlertSnoozes]);

  const alertCenter = useMemo(
    () =>
      buildAlertCenter({
        appSettings,
        calendarEntries,
        certificates,
        clientPackages,
        clientProfiles,
        defaultAppSettings,
        dismissedAlertIds: dismissedClientAlertIds,
        inactiveClientDays,
        notificationInbox,
        snoozes: alertSnoozes,
        supplies,
        tasks,
        visits,
      }),
    [
      alertSnoozes,
      appSettings,
      calendarEntries,
      certificates,
      clientPackages,
      clientProfiles,
      defaultAppSettings,
      dismissedClientAlertIds,
      inactiveClientDays,
      notificationInbox,
      supplies,
      tasks,
      visits,
    ],
  );

  const quietHoursActive = useMemo(
    () => isQuietHours(new Date(), appSettings),
    [appSettings],
  );

  const refreshServerEvents = useCallback(async () => {
    if (!appSettings.notificationsEnabled) {
      setServerEvents([]);
      setServerConnected(false);
      return;
    }

    try {
      await generateNotificationEvents();
      const events = await fetchNotificationEvents({limit: 40, status: "active"});
      setServerEvents(Array.isArray(events) ? events : []);
      setServerConnected(true);
    } catch {
      setServerEvents([]);
      setServerConnected(false);
    }
  }, [appSettings.notificationsEnabled]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void refreshServerEvents();
    }, 0);
    const intervalTimer = window.setInterval(refreshServerEvents, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [refreshServerEvents]);

  const serverAlerts = useMemo(
    () => serverEvents.map(mapServerEventToAlert),
    [serverEvents],
  );

  useEffect(() => {
    if (!clientAlertsOpen || serverEvents.length === 0) {
      return undefined;
    }

    const newEvents = serverEvents.filter((event) => event.status === "new");
    if (newEvents.length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const seenAt = new Date().toISOString();
      newEvents.forEach((event) => {
        void updateNotificationEvent(event.id, {
          action: "seen",
          status: "seen",
        });
      });
      setServerEvents((current) =>
        current.map((event) =>
          newEvents.some((newEvent) => newEvent.id === event.id)
            ? {...event, lastSeenAt: seenAt, status: "seen"}
            : event,
        ),
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clientAlertsOpen, serverEvents]);

  const combinedAlerts = useMemo(() => {
    const clientAlerts = serverConnected
      ? alertCenter.alerts.filter(
          (alert) =>
            alert.type !== "calendar" &&
            alert.type !== "task" &&
            alert.type !== "supply" &&
            alert.type !== "package" &&
            alert.type !== "certificate"
        )
      : alertCenter.alerts;
    return [...serverAlerts, ...clientAlerts];
  }, [alertCenter.alerts, serverAlerts, serverConnected]);

  const quietFilteredAlerts = useMemo(
    () => applyQuietHoursFilter(combinedAlerts, appSettings),
    [appSettings, combinedAlerts],
  );

  const visibleAlerts = useMemo(
    () => filterAlertsByMode(quietFilteredAlerts, alertFilter),
    [alertFilter, quietFilteredAlerts],
  );

  const drawerCounts = useMemo(() => {
    const urgentAlertsCount = quietFilteredAlerts.filter(
      (alert) => alert.priority === "critical" || alert.priority === "action",
    ).length;

    return {
      alertsCount: visibleAlerts.length,
      totalAlertsCount: quietFilteredAlerts.length,
      urgentAlertsCount,
    };
  }, [quietFilteredAlerts, visibleAlerts.length]);

  const snoozeAlertIdsUntil = useCallback(
    (alertOrId, until) => {
      const alertIds = resolveAlertIds(alertOrId);

      if (alertIds.length === 0) {
        return;
      }

      setAlertSnoozes((current) => {
        const next = {...current};
        alertIds.forEach((alertId) => {
          next[alertId] = until.toISOString();
        });
        return next;
      });
      alertIds
        .filter(isServerAlertId)
        .forEach((alertId) => {
          const eventId = getServerEventId(alertId);
          if (!Number.isFinite(eventId)) return;
          void updateNotificationEvent(eventId, {
            action: "snooze",
            snoozedUntil: until.toISOString(),
          });
        });
      setServerEvents((current) =>
        current.map((event) =>
          alertIds.includes(`${SERVER_ALERT_PREFIX}${event.id}`)
            ? {...event, snoozedUntil: until.toISOString(), status: "snoozed"}
            : event,
        ),
      );
      setActiveClientAlertId(null);
    },
    [setActiveClientAlertId, setAlertSnoozes],
  );

  const snoozeAlertToday = useCallback(
    (alertOrId) => {
      snoozeAlertIdsUntil(alertOrId, getEndOfToday());
    },
    [snoozeAlertIdsUntil],
  );

  const snoozeAlertWeek = useCallback(
    (alertOrId) => {
      snoozeAlertIdsUntil(alertOrId, getSnoozeUntilDays(7));
    },
    [snoozeAlertIdsUntil],
  );

  const snoozeAlertDays = useCallback(
    (alertOrId, days) => {
      snoozeAlertIdsUntil(alertOrId, getSnoozeUntilDays(days));
    },
    [snoozeAlertIdsUntil],
  );

  const dismissAlertPermanent = useCallback(
    (alertOrId) => {
      const alertIds = resolveAlertIds(alertOrId);

      setDismissedClientAlertIds((current) => [
        ...current,
        ...alertIds.filter((alertId) => !current.includes(alertId)),
      ]);
      setAlertSnoozes((current) => {
        const next = {...current};
        alertIds.forEach((alertId) => {
          delete next[alertId];
        });
        return next;
      });
      alertIds
        .filter(isServerAlertId)
        .forEach((alertId) => {
          const eventId = getServerEventId(alertId);
          if (!Number.isFinite(eventId)) return;
          void updateNotificationEvent(eventId, {
            action: "dismiss",
            status: "dismissed",
          });
        });
      setServerEvents((current) =>
        current.filter((event) => !alertIds.includes(`${SERVER_ALERT_PREFIX}${event.id}`)),
      );
      setActiveClientAlertId(null);
    },
    [setActiveClientAlertId, setAlertSnoozes, setDismissedClientAlertIds],
  );

  const undoNotificationAction = useCallback(
    (notification) => {
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
      } else if (notification.undoAction?.type === "restore-certificate") {
        const certificate = notification.undoAction.payload;

        setCertificates((current) =>
          current.some((item) => item.id === certificate.id)
            ? current
            : [certificate, ...current],
        );
        setNotificationInbox((current) =>
          current.filter((item) => item.id !== notification.id),
        );
        pushNotification({
          title: "Сертификат восстановлен",
          message: `${certificate.code} · ${certificate.client}`,
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
    },
    [pushNotification, setCertificates, setClientPackages, setNotificationInbox, setPackagesCatalog],
  );

  const openClientMessageTemplates = useCallback(
    (client) => {
      setPreferredMessageClientId(String(client.id));
      setActivePage("templates");
      setClientAlertsOpen(false);
      setActiveClientAlertId(null);
    },
    [
      setActiveClientAlertId,
      setActivePage,
      setClientAlertsOpen,
      setPreferredMessageClientId,
    ],
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
            smartVisitAlertIds.current.has(entry.id) ||
            !shouldShowSmartVisitPopup(difference, appSettings, now)
          ) {
            return;
          }

          smartVisitAlertIds.current.add(entry.id);
          pushNotification({
            title:
              difference === 0 ? "Визит начинается сейчас" : `Визит через ${difference} мин.`,
            message: `${entry.client} · ${entry.service} · ${entry.master}`,
            tone: "urgent",
            actions: [
              {label: "Календарь", action: "calendar", entityId: entry.id},
              {label: "Написать", action: "write", entityId: entry.clientId || entry.client},
            ],
            meta: {entry},
          });
        });
    };

    checkUpcomingVisits();
    const timer = window.setInterval(checkUpcomingVisits, 60000);

    return () => window.clearInterval(timer);
  }, [
    appSettings,
    appSettings.notificationsEnabled,
    appSettings.quietHoursEnabled,
    appSettings.quietHoursEnd,
    appSettings.quietHoursStart,
    appSettings.smartVisitPopupMinutes,
    appSettings.smartVisitPopupsEnabled,
    appSettings.todayVisitAlertsEnabled,
    calendarEntries,
    pushNotification,
  ]);

  return {
    alertSummary: alertCenter.summary,
    alerts: visibleAlerts,
    alertsCount: drawerCounts.alertsCount,
    dismissAlertPermanent,
    openClientMessageTemplates,
    quietHoursActive,
    snoozeAlertDays,
    snoozeAlertToday,
    snoozeAlertWeek,
    totalAlertsCount: drawerCounts.totalAlertsCount,
    undoNotificationAction,
    urgentAlertsCount: drawerCounts.urgentAlertsCount,
  };
}
