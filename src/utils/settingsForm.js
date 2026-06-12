import {syncSettingsWithColorTheme} from "./colorTheme.js";

export const parseSettingsForm = (form, appSettings, defaultAppSettings) =>
  syncSettingsWithColorTheme({
    ...appSettings,
    studioName:
      String(form.get("studioName") ?? "").trim() || defaultAppSettings.studioName,
    ownerName:
      String(form.get("ownerName") ?? "").trim() || defaultAppSettings.ownerName,
    colorTheme: form.get("colorTheme") || defaultAppSettings.colorTheme,
  sidebarVisible: appSettings.sidebarVisible,
  compactMode: form.get("compactMode") === "on",
  animationsEnabled: appSettings.animationsEnabled,
  notificationsEnabled: form.get("notificationsEnabled") === "on",
  taskAlertsEnabled: form.get("taskAlertsEnabled") === "on",
  supplyAlertsEnabled: form.get("supplyAlertsEnabled") === "on",
  packageBalanceAlertsEnabled: form.get("packageBalanceAlertsEnabled") === "on",
  forecastAlertsEnabled: form.get("forecastAlertsEnabled") === "on",
  alertAggregationEnabled: form.get("alertAggregationEnabled") === "on",
  quietHoursEnabled: form.get("quietHoursEnabled") === "on",
  quietHoursStart: form.get("quietHoursStart") || defaultAppSettings.quietHoursStart,
  quietHoursEnd: form.get("quietHoursEnd") || defaultAppSettings.quietHoursEnd,
  inactiveClientAlertsEnabled: form.get("inactiveClientAlertsEnabled") === "on",
  inactiveClientDays:
    Math.max(1, Number(form.get("inactiveClientDays"))) ||
    defaultAppSettings.inactiveClientDays,
  inactiveClientAlertLimit:
    Math.max(3, Number(form.get("inactiveClientAlertLimit"))) ||
    defaultAppSettings.inactiveClientAlertLimit,
  birthdayAlertsEnabled: form.get("birthdayAlertsEnabled") === "on",
  birthdayReminderDays:
    Math.max(0, Number(form.get("birthdayReminderDays"))) ||
    defaultAppSettings.birthdayReminderDays,
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
