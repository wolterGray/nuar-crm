import {getUpcomingBirthday} from "./clientAlerts.js";
import {getTodayInput} from "./dateHelpers.js";
import {getUpcomingVisitsWithinHours, isSameAppDay} from "./dateUtils.js";
import {buildFinanceStats, isCancelledVisit} from "./finance.js";
import {toDisplayDate} from "./formatters.jsx";
import {buildTodayFreeSlots} from "./calendarFreeSlots.js";
import {isSupplyLowStock} from "./supplyStock.js";

const sortByTime = (left, right) =>
  String(left.time ?? "00:00").localeCompare(String(right.time ?? "00:00"));

const isTodayVisit = (entry, today) =>
  entry.kind === "visit" &&
  isSameAppDay(entry.date, today) &&
  !["cancelled", "no_show"].includes(String(entry.status ?? ""));

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
  const todayBirthdays = clientProfiles
    .map((client) => ({
      ...client,
      birthdayInfo: getUpcomingBirthday(client.birthday),
    }))
    .filter((client) => client.birthdayInfo?.daysLeft === 0);

  return {
    dueTasks,
    forecastRevenue: Number(alertSummary.revenueToday) || 0,
    freeSlots: freeSlots.slice(0, 8),
    lowStockSupplies: lowStockSupplies.slice(0, 6),
    priorityAlerts,
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
