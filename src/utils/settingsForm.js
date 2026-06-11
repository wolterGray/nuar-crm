export const parseSettingsForm = (form, appSettings, defaultAppSettings) => ({
  studioName:
    String(form.get("studioName") ?? "").trim() || defaultAppSettings.studioName,
  ownerName:
    String(form.get("ownerName") ?? "").trim() || defaultAppSettings.ownerName,
  accentColor: form.get("accentColor") || defaultAppSettings.accentColor,
  theme: form.get("theme") || defaultAppSettings.theme,
  sidebarVisible: appSettings.sidebarVisible,
  compactMode: form.get("compactMode") === "on",
  animationsEnabled: appSettings.animationsEnabled,
  notificationsEnabled: form.get("notificationsEnabled") === "on",
  taskAlertsEnabled: form.get("taskAlertsEnabled") === "on",
  supplyAlertsEnabled: form.get("supplyAlertsEnabled") === "on",
  inactiveClientAlertsEnabled: form.get("inactiveClientAlertsEnabled") === "on",
  inactiveClientDays:
    Math.max(1, Number(form.get("inactiveClientDays"))) ||
    defaultAppSettings.inactiveClientDays,
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
