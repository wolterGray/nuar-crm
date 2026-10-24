import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  fetchNotificationEventCounts,
  fetchAllNotificationEvents,
  updateNotificationEvent,
} from "../api/notificationEvents.js";
import {buildAlertCenter} from "../utils/alertCenter.js";
import {
  getAggregateChildIds,
} from "../utils/alertAggregation.js";
import {
  getEndOfToday,
  getSnoozeUntilDays,
  pruneExpiredSnoozes,
} from "../utils/alertSnooze.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {
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

const getSnoozeUntilMinutes = (minutes, now = new Date()) =>
  new Date(now.getTime() + minutes * 60 * 1000);

const getServerAlertPage = (event) => {
  if (event.type === "site_booking_request" || event.type === "booking_request") return "operations";
  if (event.type?.startsWith("visit_") || event.entityType === "calendar_entry" || event.entityType === "visit") return "calendar";
  if (event.type?.startsWith("waitlist_") || event.entityType === "waitlist_entry") return "operations";
  if (event.type?.startsWith("supply_") || event.entityType === "supply") return "operations";
  return "calendar";
};

const getServerAlertType = (event) => {
  if (event.type === "site_booking_request" || event.type === "booking_request") return "site_booking";
  if (event.type === "visit_created") return "visit_created";
  if (event.type === "visit_rescheduled") return "visit_rescheduled";
  if (event.type === "visit_cancelled") return "visit_cancelled";
  if (event.type?.startsWith("waitlist_")) return "waitlist";
  if (event.type === "supply_out_of_stock") return "supply_out_of_stock";
  if (event.type === "supply_low_stock") return "supply_low_stock";
  return event.type || "notification";
};

const getServerAlertGroup = (event) => {
  if (event.type === "site_booking_request" || event.type === "booking_request" || event.type?.startsWith("waitlist_")) return "waitlist";
  if (event.type?.startsWith("visit_")) return "calendar";
  if (event.type?.startsWith("supply_")) return "supplies";
  return "notifications";
};

const getServerAlertPriority = (event) => {
  if (event.category === "critical" || event.type === "supply_out_of_stock") return "critical";
  if (event.category === "action" || event.type === "site_booking_request" || event.type === "booking_request" || event.type === "supply_low_stock") return "action";
  return "info";
};

const getServerAlertActions = () => ["open", "dismiss"];

const mapServerEventToAlert = (event) => ({
  actions: getServerAlertActions(),
  category: event.category,
  createdAt: event.createdAt,
  entityId:
    event.type === "site_booking_request" || event.type === "booking_request"
      ? event.payload?.waitlistEntryId ?? event.entityId
      : event.entityId,
  group: getServerAlertGroup(event),
  id: `${SERVER_ALERT_PREFIX}${event.id}`,
  message: event.message,
  meta: {
    category: event.category,
    isCurrent: event.isCurrent,
    serverEvent: event,
    client: event.clientId ? {id: event.clientId, name: event.clientName} : null,
    entry:
      event.entityType === "calendar_entry" || event.entityType === "visit"
        ? {
            id: event.entityId,
            client: event.clientName,
            clientId: event.clientId,
            date: event.payload?.date || event.payload?.newDate,
            time: event.payload?.time || event.payload?.newTime,
          }
        : null,
    item: event.payload,
  },
  page: getServerAlertPage(event),
  priority: getServerAlertPriority(event),
  section:
    event.type === "site_booking_request" || event.type === "booking_request" || event.type?.startsWith("waitlist_")
      ? "waitlist"
      : event.type?.startsWith("supply_")
        ? "supplies"
        : "calendar",
  title: event.title,
  type: getServerAlertType(event),
  status: event.status,
  isUnviewed: event.status === "new" || !event.lastSeenAt,
});

export function useClientAlerts({
  alertFilter: _alertFilter = "all",
  alertSnoozes,
  appSettings,
  calendarEntries,
  certificates,
  clientAlertsOpen: _clientAlertsOpen,
  clientPackages,
  clientProfiles,
  completedVisits = [],
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
}) {
  const smartVisitAlertIds = useRef(new Set());
  const [serverEvents, setServerEvents] = useState([]);
  const [serverConnected, setServerConnected] = useState(null);
  const [serverCounts, setServerCounts] = useState(null);

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
        visits: completedVisits,
      }),
    [
      alertSnoozes,
      appSettings,
      calendarEntries,
      certificates,
      clientPackages,
      clientProfiles,
      completedVisits,
      defaultAppSettings,
      dismissedClientAlertIds,
      inactiveClientDays,
      notificationInbox,
      supplies,
      tasks,
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
      setServerCounts(null);
      return;
    }

    try {
      const [events, counts] = await Promise.all([
        fetchAllNotificationEvents({status: "active"}),
        fetchNotificationEventCounts(),
      ]);
      setServerEvents(Array.isArray(events) ? events : []);
      setServerCounts(counts && typeof counts === "object" ? counts : null);
      setServerConnected(true);
    } catch {
      setServerEvents([]);
      setServerCounts(null);
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

  const handleNotificationView = useCallback(
    async (alert) => {
      const serverEventId = getServerEventId(alert?.id);
      if (!Number.isFinite(serverEventId)) return;

      const previousEvents = serverEvents;
      const previousCounts = serverCounts;

      // Optimistic removal from visible state immediately
      setServerEvents((current) => current.filter((e) => e.id !== serverEventId));
      if (serverCounts) {
        setServerCounts((current) => current ? {
          ...current,
          action: Math.max(0, (current.action || 0) - (alert.priority === 'action' ? 1 : 0)),
          attention: Math.max(0, (current.attention || 0) - (alert.priority === 'critical' || alert.priority === 'action' ? 1 : 0)),
          critical: Math.max(0, (current.critical || 0) - (alert.priority === 'critical' ? 1 : 0)),
          total: Math.max(0, (current.total || 0) - 1),
        } : null);
      }

      try {
        await updateNotificationEvent(serverEventId, {
          action: "view",
          status: "resolved",
        });
      } catch (err) {
        console.error("Failed to mark notification viewed:", err);
        setServerEvents(previousEvents);
        setServerCounts(previousCounts);
      }
    },
    [serverCounts, serverEvents],
  );

  const handleNotificationDismiss = useCallback(
    async (alert) => {
      const serverEventId = getServerEventId(alert?.id);
      if (!Number.isFinite(serverEventId)) return;

      const previousEvents = serverEvents;
      const previousCounts = serverCounts;

      // Optimistic removal from visible state immediately
      setServerEvents((current) => current.filter((e) => e.id !== serverEventId));
      if (serverCounts) {
        setServerCounts((current) => current ? {
          ...current,
          action: Math.max(0, (current.action || 0) - (alert.priority === 'action' ? 1 : 0)),
          attention: Math.max(0, (current.attention || 0) - (alert.priority === 'critical' || alert.priority === 'action' ? 1 : 0)),
          critical: Math.max(0, (current.critical || 0) - (alert.priority === 'critical' ? 1 : 0)),
          total: Math.max(0, (current.total || 0) - 1),
        } : null);
      }

      try {
        await updateNotificationEvent(serverEventId, {
          action: "dismiss",
          status: "dismissed",
        });
      } catch (err) {
        console.error("Failed to dismiss notification:", err);
        setServerEvents(previousEvents);
        setServerCounts(previousCounts);
      }
    },
    [serverCounts, serverEvents],
  );

  const combinedAlerts = useMemo(() => {
    return serverAlerts;
  }, [serverAlerts]);

  const quietFilteredAlerts = useMemo(
    () => combinedAlerts,
    [combinedAlerts],
  );

  const visibleAlerts = useMemo(
    () => quietFilteredAlerts,
    [quietFilteredAlerts],
  );

  const drawerCounts = useMemo(() => {
    return {
      alertsCount: visibleAlerts.length,
      totalAlertsCount: visibleAlerts.length,
      urgentAlertsCount: visibleAlerts.filter(
        (alert) => alert.priority === "critical" || alert.priority === "action",
      ).length,
    };
  }, [visibleAlerts]);

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

  const snoozeAlertReview = useCallback(
    (alertOrId) => {
      snoozeAlertIdsUntil(alertOrId, getSnoozeUntilMinutes(30));
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

  const restoreAlertSnooze = useCallback(
    (alertOrId) => {
      const alertIds = resolveAlertIds(alertOrId);

      if (alertIds.length === 0) {
        return;
      }

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
            action: "seen",
            snoozedUntil: null,
            status: "seen",
          });
        });
      setServerEvents((current) =>
        current.map((event) =>
          alertIds.includes(`${SERVER_ALERT_PREFIX}${event.id}`)
            ? {...event, snoozedUntil: null, status: "seen"}
            : event,
        ),
      );
      setActiveClientAlertId(null);
    },
    [setActiveClientAlertId, setAlertSnoozes],
  );

  const dismissAlertPermanent = useCallback(
    async (alertOrId) => {
      const alertIds = resolveAlertIds(alertOrId);
      const serverAlertIds = alertIds.filter(isServerAlertId);

      try {
        await Promise.all(
          serverAlertIds.map((alertId) => {
            const eventId = getServerEventId(alertId);
            if (!Number.isFinite(eventId)) return Promise.resolve();
            return updateNotificationEvent(eventId, {
              action: "dismiss",
              status: "dismissed",
            });
          }),
        );
      } catch (error) {
        pushNotification?.({
          title: "Уведомление не скрыто",
          message: error?.message || "Не удалось сохранить изменение",
          persist: false,
        });
        return false;
      }

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
      setServerEvents((current) =>
        current.filter((event) => !alertIds.includes(`${SERVER_ALERT_PREFIX}${event.id}`)),
      );
      setActiveClientAlertId(null);
      if (serverAlertIds.length > 0) {
        await refreshServerEvents();
      }
      return true;
    },
    [pushNotification, refreshServerEvents, setActiveClientAlertId, setAlertSnoozes, setDismissedClientAlertIds],
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
    allAlerts: quietFilteredAlerts,
    alerts: visibleAlerts,
    alertsCount: drawerCounts.alertsCount,
    dismissAlertPermanent,
    handleNotificationDismiss,
    handleNotificationView,
    openClientMessageTemplates,
    quietHoursActive,
    restoreAlertSnooze,
    snoozeAlertDays,
    snoozeAlertReview,
    snoozeAlertToday,
    snoozeAlertWeek,
    totalAlertsCount: drawerCounts.totalAlertsCount,
    serverCounts,
    serverConnected,
    undoNotificationAction,
    urgentAlertsCount: drawerCounts.urgentAlertsCount,
  };
}

export {
  isServerAlertId,
  getServerEventId,
  mapServerEventToAlert,
};
