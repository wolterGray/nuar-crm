import {useCallback, useEffect, useMemo, useRef} from "react";
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

export function useClientAlerts({
  alertFilter = "all",
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
}) {
  const smartVisitAlertIds = useRef(new Set());

  useEffect(() => {
    setAlertSnoozes((current) => pruneExpiredSnoozes(current));
  }, [setAlertSnoozes]);

  const alertCenter = useMemo(
    () =>
      buildAlertCenter({
        appSettings,
        calendarEntries,
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

  const quietFilteredAlerts = useMemo(
    () => applyQuietHoursFilter(alertCenter.alerts, appSettings),
    [alertCenter.alerts, appSettings],
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
    [pushNotification, setClientPackages, setNotificationInbox, setPackagesCatalog],
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
