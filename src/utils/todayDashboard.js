import {getUpcomingBirthday} from "./clientAlerts.js";
import {getTodayInput} from "./dateHelpers.js";
import {getUpcomingVisitsWithinHours, isSameAppDay} from "./dateUtils.js";
import {buildFinanceStats, isCancelledVisit} from "./finance.js";
import {toDisplayDate} from "./formatters.jsx";
import {buildTodayFreeSlots} from "./calendarFreeSlots.js";
import {isSupplyLowStock} from "./supplyStock.js";
import {buildScheduleQualityReport} from "./scheduleQuality.js";

const sortByTime = (left, right) =>
  String(left.time ?? "00:00").localeCompare(String(right.time ?? "00:00"));

const isTodayVisit = (entry, today) =>
  entry.kind === "visit" &&
  isSameAppDay(entry.date, today) &&
  !["cancelled", "no_show"].includes(String(entry.status ?? ""));

const buildActionItems = ({
  dueTasks = [],
  lowStockSupplies = [],
  priorityAlerts = [],
  scheduleQualityIssues = [],
  today,
  todayBirthdays = [],
  todayStats,
}) => {
  const items = [];

  if (todayStats.debtVisits.length > 0) {
    items.push({
      id: "today-debts",
      action: "payments",
      message: `${todayStats.debtVisits.length} записей · ${todayStats.debtAmount} zł`,
      priority: "critical",
      title: "Проверить долги за сегодня",
      type: "finance",
    });
  }

  dueTasks.slice(0, 3).forEach((task) => {
    items.push({
      id: `task-${task.id}`,
      action: "operations",
      message: task.dueDate ? `Срок: ${task.dueDate}` : "Задача без даты",
      priority: task.dueDate < today ? "critical" : "action",
      title: task.title,
      type: "task",
    });
  });

  priorityAlerts.slice(0, 4).forEach((alert) => {
    items.push({
      id: `alert-${alert.id}`,
      action: alert.page === "calendar" ? "calendar" : alert.page || "operations",
      message: alert.message || "",
      priority: alert.priority,
      title: alert.title,
      type: alert.type || "alert",
    });
  });

  scheduleQualityIssues.slice(0, 4).forEach((issue) => {
    items.push({
      id: `schedule-quality-${issue.id}`,
      action: issue.action || "calendar",
      message: issue.message,
      priority: issue.priority,
      title: issue.title,
      type: issue.type || "calendar",
    });
  });

  todayBirthdays.slice(0, 3).forEach((client) => {
    items.push({
      id: `birthday-${client.id}`,
      action: "clients",
      message: "Поздравить сегодня",
      priority: "action",
      title: client.name,
      type: "birthday",
    });
  });

  lowStockSupplies.slice(0, 3).forEach((item) => {
    items.push({
      id: `supply-${item.id}`,
      action: "operations",
      message: `${item.stock} ${item.unit} · мин. ${item.minStock}`,
      priority: Number(item.stock) <= 0 ? "critical" : "action",
      title: item.name,
      type: "stock",
    });
  });

  return items
    .sort((left, right) => {
      const priority = {critical: 0, action: 1, info: 2};

      return (priority[left.priority] ?? 2) - (priority[right.priority] ?? 2);
    })
    .slice(0, 8);
};

export const buildTodayDashboard = ({
  alertSummary = {},
  alerts = [],
  appSettings = {},
  calendarEntries = [],
  certificates = [],
  clientPackages = [],
  clientProfiles = [],
  employees = [],
  now = new Date(),
  supplies = [],
  tasks = [],
  visits = [],
}) => {
  const today = getTodayInput();
  const todayStats = buildFinanceStats({
    calendarEntries,
    certificates,
    clientPackages,
    employees,
    endDate: today,
    now,
    startDate: today,
    visits,
  });
  const todayVisits = calendarEntries
    .filter((entry) => isTodayVisit(entry, today))
    .sort(sortByTime)
    .map((entry) => ({
      ...entry,
      isActive: !["completed", "cancelled", "no_show"].includes(
        String(entry.status ?? ""),
      ),
    }));
  const upcomingVisits = getUpcomingVisitsWithinHours(todayVisits, 3, now);
  const freeSlots = buildTodayFreeSlots({
    appSettings,
    calendarEntries,
    employees,
    now,
    today,
  });
  const dueTasks = tasks
    .filter(
      (task) =>
        task.type !== "note" &&
        task.status !== "completed" &&
        task.dueDate &&
        task.dueDate <= today,
    )
    .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));
  const lowStockSupplies = supplies
    .filter(isSupplyLowStock)
    .sort((left, right) => Number(left.stock) - Number(right.stock));
  const priorityAlerts = alerts
    .filter((alert) => alert.priority === "critical" || alert.priority === "action")
    .slice(0, 6);
  const scheduleQuality = buildScheduleQualityReport({
    calendarEntries,
    clientProfiles,
    date: today,
  });
  const todayBirthdays = clientProfiles
    .map((client) => ({
      ...client,
      birthdayInfo: getUpcomingBirthday(client.birthday),
    }))
    .filter((client) => client.birthdayInfo?.daysLeft === 0);
  const actionItems = buildActionItems({
    dueTasks,
    lowStockSupplies,
    priorityAlerts,
    scheduleQualityIssues: scheduleQuality.issues,
    today,
    todayBirthdays,
    todayStats,
  });

  return {
    actionItems,
    dueTasks,
    forecastRevenue: Number(alertSummary.revenueToday) || 0,
    freeSlots: freeSlots.slice(0, 8),
    lowStockSupplies: lowStockSupplies.slice(0, 6),
    priorityAlerts,
    scheduleQuality,
    snapshot: {
      completedVisits: todayStats.completedAppointments.length,
      debtAmount: todayStats.debtAmount,
      debtVisits: todayStats.debtVisits.length,
      received: todayStats.receivedRevenue,
      scheduledVisits: todayVisits.length,
      upcomingCount: upcomingVisits.length,
    },
    today,
    todayBirthdays,
    todayDisplay: toDisplayDate(today),
    todayVisits,
    upcomingVisits,
    urgentAlertsCount: Number(alertSummary.urgentCount) || priorityAlerts.length,
  };
};

export {isCancelledVisit, isTodayVisit};
