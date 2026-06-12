import {getUpcomingBirthday} from "./clientAlerts.js";
import {isActiveClientPackage} from "./clientPackages.js";
import {matchesClientRecord} from "./clientLinks.js";
import {
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
} from "./formatters.jsx";
import {getTodayInput} from "./dateHelpers.js";
import {shiftAppDate} from "./dateUtils.js";
import {isAlertHidden} from "./alertSnooze.js";
import {aggregateDisplayAlerts} from "./alertAggregation.js";
import {isSupplyLowStock, isSupplyOutOfStock} from "./supplyStock.js";
import {isCalendarVisitCompleted} from "./calendarVisitStatus.js";
import {toVisitNumber} from "./visits.jsx";

const PRIORITY_ORDER = {critical: 0, action: 1, info: 2};

const sortAlerts = (left, right) => {
  const priorityDiff =
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return String(left.title).localeCompare(String(right.title), "ru");
};

const createAlert = (alert) => ({
  actions: [],
  group: "info",
  priority: "info",
  ...alert,
});

export const buildInactiveClients = ({
  calendarEntries,
  clientProfiles,
  inactiveClientDays,
  visits,
}) =>
  clientProfiles
    .map((client) => {
      const completedCalendarDates = calendarEntries
        .filter(
          (entry) =>
            matchesClientRecord(entry, clientProfiles, client) &&
            isCalendarVisitCompleted(entry),
        )
        .map((entry) => toDisplayDate(entry.date));
      const lastVisit =
        getLatestDisplayDate([
          ...visits
            .filter(
              (visit) =>
                matchesClientRecord(visit, clientProfiles, client) &&
                visit.recordType !== "operation",
            )
            .map((visit) => visit.date),
          ...completedCalendarDates,
        ]) || "";

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
    );

export const buildAlertCenter = ({
  appSettings,
  calendarEntries,
  clientPackages,
  clientProfiles,
  defaultAppSettings,
  dismissedAlertIds = [],
  inactiveClientDays,
  notificationInbox = [],
  snoozes = {},
  supplies = [],
  tasks = [],
  visits = [],
  now = new Date(),
}) => {
  if (!appSettings.notificationsEnabled) {
    return {
      alerts: [],
      summary: {revenueToday: 0, urgentCount: 0, visitsToday: 0},
      totalCount: 0,
      urgentCount: 0,
    };
  }

  const today = getTodayInput();
  const tomorrow = shiftAppDate(today, 1);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isHidden = (alertId) =>
    isAlertHidden(alertId, dismissedAlertIds, snoozes, now);
  const alerts = [];

  if (appSettings.todayVisitAlertsEnabled) {
    const mode = appSettings.todayVisitAlertMode ?? "all";
    const upcomingMinutes = Math.max(
      15,
      Number(appSettings.upcomingVisitMinutes) || 180,
    );

    calendarEntries
      .filter((entry) => entry.date === today && entry.kind === "visit")
      .filter((entry) => !["completed", "cancelled", "no_show"].includes(entry.status))
      .filter((entry) => {
        const [hours, minutes] = String(entry.time ?? "00:00").split(":").map(Number);
        const difference = hours * 60 + minutes - currentMinutes;

        if (mode === "upcoming") {
          return difference >= 0 && difference <= upcomingMinutes;
        }

        return difference >= 0;
      })
      .forEach((entry) => {
        const alertId = `calendar-${entry.id}`;
        const [hours, minutes] = String(entry.time ?? "00:00").split(":").map(Number);
        const difference = hours * 60 + minutes - currentMinutes;
        const priority =
          difference <= (Number(appSettings.smartVisitPopupMinutes) || 15)
            ? "critical"
            : "action";

        if (isHidden(alertId)) {
          return;
        }

        alerts.push(
          createAlert({
            id: alertId,
            type: "calendar",
            group: "calendar",
            priority,
            title: `${entry.time} · ${entry.client}`,
            message: `${entry.service} · ${entry.master}`,
            page: "calendar",
            entityId: entry.id,
            actions: ["write", "calendar", "snooze"],
            meta: {entry},
          }),
        );
      });
  }

  if (appSettings.taskAlertsEnabled) {
    tasks
      .filter(
        (task) =>
          task.type !== "note" &&
          task.status !== "completed" &&
          task.dueDate &&
          task.dueDate <= today,
      )
      .forEach((task) => {
        const alertId = `task-${task.id}`;
        const overdue = task.dueDate < today;

        if (isHidden(alertId)) {
          return;
        }

        alerts.push(
          createAlert({
            id: alertId,
            type: "task",
            group: "operations",
            priority: overdue ? "critical" : "action",
            title: task.title,
            message: overdue ? `Просрочено: ${task.dueDate}` : "Срок сегодня",
            page: "operations",
            entityId: task.id,
            section: "tasks",
            actions: ["complete", "open", "snooze"],
            meta: {task},
          }),
        );
      });
  }

  if (appSettings.supplyAlertsEnabled) {
    supplies.filter(isSupplyLowStock).forEach((item) => {
      const alertId = `supply-${item.id}`;
      const outOfStock = isSupplyOutOfStock(item);

      if (isHidden(alertId)) {
        return;
      }

      const actions = ["open", "snooze"];

      if (item.orderUrl) {
        actions.unshift("order");
      }

      actions.splice(actions.length - 1, 0, "stock");

      alerts.push(
        createAlert({
          id: alertId,
          type: "supply",
          group: "operations",
          priority: outOfStock ? "critical" : "action",
          title: item.name,
          message: `Остаток ${item.stock} ${item.unit} · минимум ${item.minStock}`,
          page: "operations",
          entityId: item.id,
          section: "supplies",
          actions,
          meta: {item},
        }),
      );
    });
  }

  if (appSettings.packageBalanceAlertsEnabled !== false) {
    clientPackages
      .filter(
        (item) =>
          isActiveClientPackage(item) && Number(item.remainingVisits) <= 2,
      )
      .forEach((item) => {
        const alertId = `package-balance-${item.id}-${item.remainingVisits}`;
        const remaining = Number(item.remainingVisits);

        if (isHidden(alertId)) {
          return;
        }

        alerts.push(
          createAlert({
            id: alertId,
            type: "package",
            group: "packages",
            priority: remaining === 0 ? "critical" : "info",
            title: item.client,
            message:
              remaining === 0
                ? `${item.packageName}: сеансы закончились`
                : `${item.packageName}: осталось ${remaining}`,
            page: "clients",
            entityId: item.client,
            actions: ["client", "snooze"],
            meta: {item},
          }),
        );
      });
  }

  if (appSettings.birthdayAlertsEnabled) {
    const reminderDays = Math.max(
      0,
      Number(appSettings.birthdayReminderDays) || defaultAppSettings.birthdayReminderDays,
    );

    clientProfiles
      .map((client) => ({...client, birthdayInfo: getUpcomingBirthday(client.birthday)}))
      .filter((client) => client.birthdayInfo && client.birthdayInfo.daysLeft <= reminderDays)
      .forEach((client) => {
        const alertId = `birthday-${client.id}-${now.getFullYear()}`;
        const todayBirthday = client.birthdayInfo.daysLeft === 0;

        if (isHidden(alertId)) {
          return;
        }

        alerts.push(
          createAlert({
            id: alertId,
            type: "birthday",
            group: "birthdays",
            priority: todayBirthday ? "action" : "info",
            title: client.name,
            message: `${client.birthdayInfo.date} · поздравить клиента`,
            page: "templates",
            entityId: client.id,
            actions: ["write", "snooze"],
            meta: {client},
          }),
        );
      });
  }

  if (appSettings.inactiveClientAlertsEnabled) {
    buildInactiveClients({
      calendarEntries,
      clientProfiles,
      inactiveClientDays,
      visits,
    }).forEach((client) => {
      const alertId = `inactive-${client.id}`;

      if (isHidden(alertId)) {
        return;
      }

      alerts.push(
        createAlert({
          id: alertId,
          type: "inactive",
          group: "inactive",
          priority: client.daysAbsent >= inactiveClientDays * 2 ? "action" : "info",
          title: client.name,
          message: client.phone || "Телефон не указан",
          page: "clients",
          entityId: client.id,
          actions: ["write", "client", "snooze"],
          meta: {client},
        }),
      );
    });
  }

  const forecastForDate = (date) =>
    calendarEntries
      .filter(
        (entry) =>
          entry.kind === "visit" &&
          entry.date === date &&
          !["cancelled", "no_show"].includes(entry.status),
      )
      .reduce((sum, entry) => sum + toVisitNumber(entry.amount), 0);

  if (appSettings.forecastAlertsEnabled !== false) {
    [
      {
        alertId: `forecast-${today}`,
        title: "Прогноз на сегодня",
        date: today,
      },
      {
        alertId: `forecast-${tomorrow}`,
        title: "Прогноз на завтра",
        date: tomorrow,
      },
    ].forEach(({alertId, date, title}) => {
      const revenue = forecastForDate(date);

      if (revenue <= 0 || isHidden(alertId)) {
        return;
      }

      alerts.push(
        createAlert({
          id: alertId,
          type: "forecast",
          group: "forecast",
          priority: "info",
          title,
          message: `${revenue} zł`,
          page: "calendar",
          actions: ["calendar", "snooze"],
          meta: {date, revenue},
        }),
      );
    });
  }

  notificationInbox
    .filter((notification) => notification.undoAction)
    .forEach((notification) => {
      alerts.push(
        createAlert({
          id: `undo-${notification.id}`,
          type: "undo",
          group: "system",
          priority: "action",
          title: notification.title,
          message: notification.message,
          actions: notification.undoAction ? ["undo", "dismiss"] : ["dismiss"],
          meta: {notification},
        }),
      );
    });

  alerts.sort(sortAlerts);
  const displayAlerts = aggregateDisplayAlerts(alerts, appSettings);

  const urgentCount = displayAlerts.filter(
    (alert) => alert.priority === "critical" || alert.priority === "action",
  ).length;
  const visitsToday = calendarEntries.filter(
    (entry) =>
      entry.date === today &&
      entry.kind === "visit" &&
      !["cancelled", "no_show"].includes(entry.status),
  ).length;

  return {
    alerts: displayAlerts,
    rawAlerts: alerts,
    summary: {
      revenueToday: forecastForDate(today),
      urgentCount,
      visitsToday,
    },
    totalCount: displayAlerts.length,
    urgentCount,
  };
};

export const filterAlertsByMode = (alerts, mode = "all") => {
  if (mode === "urgent") {
    return alerts.filter(
      (alert) => alert.priority === "critical" || alert.priority === "action",
    );
  }

  if (mode === "clients") {
    return alerts.filter(
      (alert) =>
        alert.type === "birthday" ||
        alert.type === "inactive" ||
        alert.type === "package" ||
        alert.aggregateKind === "inactive" ||
        alert.aggregateKind === "birthdays" ||
        alert.aggregateKind === "packages",
    );
  }

  if (mode === "operations") {
    return alerts.filter(
      (alert) =>
        alert.type === "task" ||
        alert.type === "supply" ||
        alert.aggregateKind === "supplies" ||
        alert.aggregateKind === "tasks",
    );
  }

  return alerts;
};

export const groupAlerts = (alerts) => {
  const groups = new Map();

  alerts.forEach((alert) => {
    const current = groups.get(alert.group) ?? [];
    current.push(alert);
    groups.set(alert.group, current);
  });

  return groups;
};

export const ALERT_GROUP_LABELS = {
  calendar: "Ближайшие визиты",
  operations: "Задачи и склад",
  packages: "Пакеты клиентов",
  birthdays: "Дни рождения",
  inactive: "Давно не были",
  forecast: "Прогноз",
  system: "Изменения",
};
