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
  certificateAlertsEnabled: form.get("certificateAlertsEnabled") === "on",
  certificateExpiryReminderDays:
    Math.max(1, Number(form.get("certificateExpiryReminderDays"))) ||
    defaultAppSettings.certificateExpiryReminderDays,
  certificateLowBalancePercent:
    Math.max(1, Number(form.get("certificateLowBalancePercent"))) ||
    defaultAppSettings.certificateLowBalancePercent,
  smsRemindersEnabled: form.get("smsRemindersEnabled") === "on",
  smsReminder24hEnabled: form.get("smsReminder24hEnabled") === "on",
  smsReminder2hEnabled: form.get("smsReminder2hEnabled") === "on",
  smsAutoProcessEnabled: form.get("smsAutoProcessEnabled") === "on",
  smsAutoProcessMinutes:
    Math.max(5, Number(form.get("smsAutoProcessMinutes"))) ||
    defaultAppSettings.smsAutoProcessMinutes,
  smsSenderName:
    String(form.get("smsSenderName") ?? "").trim() ||
    defaultAppSettings.smsSenderName,
  smsRemindersLastRunAt: appSettings.smsRemindersLastRunAt ?? "",
  telegramDigestEnabled: form.get("telegramDigestEnabled") === "on",
  telegramDigestTime:
    String(form.get("telegramDigestTime") ?? "").trim() ||
    defaultAppSettings.telegramDigestTime,
  telegramChatId: String(form.get("telegramChatId") ?? "").trim(),
  telegramDigestLastRunAt: appSettings.telegramDigestLastRunAt ?? "",
  siteBookingNotifyTelegramEnabled:
    form.get("siteBookingNotifyTelegramEnabled") === "on",
  siteBookingNotifyWhatsappEnabled:
    form.get("siteBookingNotifyWhatsappEnabled") === "on",
  ownerNotifyPhone: String(form.get("ownerNotifyPhone") ?? "").trim(),
  reviewRequestsEnabled: form.get("reviewRequestsEnabled") === "on",
  reviewRequestDelayHours:
    Math.max(1, Number(form.get("reviewRequestDelayHours"))) ||
    defaultAppSettings.reviewRequestDelayHours,
  reviewGoogleUrl: String(form.get("reviewGoogleUrl") ?? "").trim(),
  reviewBooksyUrl: String(form.get("reviewBooksyUrl") ?? "").trim(),
  reviewPrimaryUrl: String(form.get("reviewPrimaryUrl") ?? "").trim(),
  reviewRequestAutoProcessEnabled:
    form.get("reviewRequestAutoProcessEnabled") === "on",
  reviewRequestAutoProcessMinutes:
    Math.max(10, Number(form.get("reviewRequestAutoProcessMinutes"))) ||
    defaultAppSettings.reviewRequestAutoProcessMinutes,
  reviewRequestLastRunAt: appSettings.reviewRequestLastRunAt ?? "",
  inactiveFollowUpEnabled: form.get("inactiveFollowUpEnabled") === "on",
  inactiveFollowUp14Enabled: form.get("inactiveFollowUp14Enabled") === "on",
  inactiveFollowUp30Enabled: form.get("inactiveFollowUp30Enabled") === "on",
  inactiveFollowUp60Enabled: form.get("inactiveFollowUp60Enabled") === "on",
  inactiveFollowUpAutoProcessEnabled:
    form.get("inactiveFollowUpAutoProcessEnabled") === "on",
  inactiveFollowUpAutoProcessMinutes:
    Math.max(30, Number(form.get("inactiveFollowUpAutoProcessMinutes"))) ||
    defaultAppSettings.inactiveFollowUpAutoProcessMinutes,
  inactiveFollowUpLastRunAt: appSettings.inactiveFollowUpLastRunAt ?? "",
  waitlistEnabled: form.get("waitlistEnabled") === "on",
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

export const parseSiteBookingNotifyForm = (form, appSettings) => ({
  ...appSettings,
  telegramChatId: String(form.get("telegramChatId") ?? "").trim(),
  siteBookingNotifyTelegramEnabled:
    form.get("siteBookingNotifyTelegramEnabled") === "on",
  siteBookingNotifyWhatsappEnabled:
    form.get("siteBookingNotifyWhatsappEnabled") === "on",
  ownerNotifyPhone: String(form.get("ownerNotifyPhone") ?? "").trim(),
});
