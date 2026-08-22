import {getAggregateChildIds} from "./alertAggregation.js";

export const getNotificationAlertIds = (alert) => {
  if (alert?.type === "aggregate") {
    return getAggregateChildIds(alert);
  }

  return alert?.id ? [alert.id] : [];
};

export const getActiveHiddenAlertIds = (locallyHiddenAlerts = {}, now = Date.now()) =>
  new Set(
    Object.entries(locallyHiddenAlerts)
      .filter(([, hiddenUntil]) => Number(hiddenUntil) > now)
      .map(([alertId]) => alertId),
  );

export const filterVisibleNotificationAlerts = (
  alerts = [],
  activeHiddenIds = new Set(),
) =>
  alerts
    .map((alert) => {
      if (alert?.type !== "aggregate") {
        return activeHiddenIds.has(alert?.id) ? null : alert;
      }

      const visibleChildren = alert.children.filter(
        (childAlert) => !activeHiddenIds.has(childAlert.id),
      );

      if (visibleChildren.length === 0) {
        return null;
      }

      if (visibleChildren.length === alert.children.length) {
        return alert;
      }

      return {...alert, children: visibleChildren};
    })
    .filter(Boolean);

export const getNotificationDrawerCounts = ({
  alerts = [],
  locallyHiddenAlerts = {},
  now = Date.now(),
} = {}) => {
  const activeHiddenIds = getActiveHiddenAlertIds(locallyHiddenAlerts, now);
  const visibleAlerts = filterVisibleNotificationAlerts(alerts, activeHiddenIds);
  const urgentAlertsCount = visibleAlerts.filter(
    (alert) => alert.priority === "critical" || alert.priority === "action",
  ).length;

  return {
    activeHiddenIds,
    alertsCount: visibleAlerts.length,
    badgeCount: visibleAlerts.length,
    totalAlertsCount: visibleAlerts.length,
    urgentAlertsCount,
    visibleAlerts,
  };
};
