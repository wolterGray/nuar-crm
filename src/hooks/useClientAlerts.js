import {useCallback, useEffect, useMemo, useRef} from "react";
import {matchesClientRecord} from "../utils/clientLinks.js";
import {getUpcomingBirthday} from "../utils/clientAlerts.js";
import {
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
} from "../utils/formatters.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";
import {shiftAppDate} from "../utils/dateUtils.js";
import {isCalendarVisitCompleted} from "../utils/calendarVisitStatus.js";
import {toVisitNumber} from "../utils/visits.jsx";

export function useClientAlerts({
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

  const inactiveClients = useMemo(
    () =>
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

        if (mode === "upcoming") {
          return difference >= 0 && difference <= upcomingMinutes;
        }
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
    defaultAppSettings.birthdayReminderDays,
    dismissedClientAlertIds,
  ]);

  const operationsAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled) {
      return [];
    }

    const today = getTodayInput();
    const taskAlerts = appSettings.taskAlertsEnabled
      ? tasks
          .filter(
            (task) => task.status !== "completed" && task.dueDate && task.dueDate <= today,
          )
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
    [appSettings.notificationsEnabled, clientPackages, dismissedClientAlertIds],
  );

  const revenueForecastAlerts = useMemo(() => {
    if (!appSettings.notificationsEnabled) {
      return [];
    }

    const today = getTodayInput();
    const tomorrow = shiftAppDate(today, 1);
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
      {
        alertId: `forecast-${today}`,
        title: "Прогноз на сегодня",
        message: `${forecast(today)} zł`,
      },
      {
        alertId: `forecast-${tomorrow}`,
        title: "Прогноз на завтра",
        message: `${forecast(tomorrow)} zł`,
      },
    ]
      .filter((item) => Number.parseFloat(item.message) > 0)
      .filter((item) => !dismissedClientAlertIds.includes(item.alertId));
  }, [appSettings.notificationsEnabled, calendarEntries, dismissedClientAlertIds]);

  const dismissAlertTemporarily = useCallback(
    (alertId, delay = 6 * 60 * 60 * 1000) => {
      setDismissedClientAlertIds((current) =>
        current.includes(alertId) ? current : [...current, alertId],
      );
      window.setTimeout(() => {
        setDismissedClientAlertIds((current) =>
          current.filter((item) => item !== alertId),
        );
      }, delay);
    },
    [setDismissedClientAlertIds],
  );

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
            smartVisitAlertIds.current.has(entry.id)
          ) {
            return;
          }

          smartVisitAlertIds.current.add(entry.id);
          pushNotification({
            title:
              difference === 0 ? "Визит начинается сейчас" : `Визит через ${difference} мин.`,
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

  return {
    actionableNotificationInbox,
    alertsCount,
    birthdayAlerts,
    dismissAlertTemporarily,
    inactiveClientAlerts,
    openClientMessageTemplates,
    operationsAlerts,
    packageBalanceAlerts,
    revenueForecastAlerts,
    todayCalendarAlerts,
    undoNotificationAction,
  };
}
