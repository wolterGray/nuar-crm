const hoursSince = (value, now = new Date()) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (now.getTime() - date.getTime()) / (60 * 60 * 1000);
};

const formatLastRun = (value) => {
  if (!value) {
    return "запусков ещё не было";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "запусков ещё не было";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
};

const buildAutomationHealth = ({
  enabled,
  id,
  lastRunWarningHours,
  name,
  okMessage = "Готово",
  status = {},
  statusChecks = [],
  warningMessage = "Проверьте настройки",
  now,
}) => {
  if (!enabled) {
    return {
      id,
      lastRunLabel: "выключено",
      message: "Автоматизация выключена",
      name,
      state: "off",
    };
  }

  const failedCheck = statusChecks.find((check) => !check.ok);
  const lastRunHours = hoursSince(status.lastRunAt, now);
  const stale =
    lastRunWarningHours &&
    (lastRunHours === null || lastRunHours > lastRunWarningHours);

  if (failedCheck || stale) {
    return {
      id,
      lastRunLabel: formatLastRun(status.lastRunAt),
      message: failedCheck?.message || warningMessage,
      name,
      state: "warning",
    };
  }

  return {
    id,
    lastRunLabel: formatLastRun(status.lastRunAt),
    message: okMessage,
    name,
    state: "ok",
  };
};

export const buildIntegrationHealth = ({
  inactiveFollowUp,
  now = new Date(),
  reviewRequests,
  settings = {},
  smsReminders,
  telegramDigest,
}) => {
  const items = [
    buildAutomationHealth({
      enabled: settings.telegramDigestEnabled,
      id: "telegram-digest",
      lastRunWarningHours: 30,
      name: "Telegram digest",
      okMessage: "Бот и chat ID готовы",
      status: telegramDigest?.status,
      statusChecks: [
        {
          ok: telegramDigest?.status?.telegramTokenConfigured,
          message: "Нет TELEGRAM_BOT_TOKEN",
        },
        {
          ok: telegramDigest?.status?.telegramChatIdConfigured,
          message: "Нет Telegram Chat ID",
        },
      ],
      warningMessage: "Дайджест давно не запускался",
      now,
    }),
    buildAutomationHealth({
      enabled: settings.smsRemindersEnabled,
      id: "sms-reminders",
      lastRunWarningHours: 2,
      name: "SMS reminders",
      okMessage: `${Number(smsReminders?.status?.dueCount) || 0} ожидают`,
      status: smsReminders?.status,
      statusChecks: [
        {
          ok: smsReminders?.status?.configured,
          message: "Нет SMSAPI_TOKEN",
        },
      ],
      warningMessage: "Cron давно не запускался",
      now,
    }),
    buildAutomationHealth({
      enabled: settings.reviewRequestsEnabled,
      id: "review-requests",
      lastRunWarningHours: 6,
      name: "Review requests",
      okMessage: `${Number(reviewRequests?.status?.dueCount) || 0} ожидают`,
      status: reviewRequests?.status,
      statusChecks: [
        {
          ok: reviewRequests?.status?.configured,
          message: "Нет SMSAPI_TOKEN",
        },
      ],
      warningMessage: "Автопроверка отзывов давно не запускалась",
      now,
    }),
    buildAutomationHealth({
      enabled: settings.inactiveFollowUpEnabled,
      id: "inactive-follow-up",
      lastRunWarningHours: 8,
      name: "Inactive follow-up",
      okMessage: `${Number(inactiveFollowUp?.status?.dueCount) || 0} ожидают`,
      status: inactiveFollowUp?.status,
      statusChecks: [
        {
          ok: inactiveFollowUp?.status?.configured,
          message: "Нет SMSAPI_TOKEN",
        },
      ],
      warningMessage: "Follow-up давно не запускался",
      now,
    }),
    {
      id: "gmail-oauth",
      lastRunLabel: settings.gmailClientId ? "Client ID задан" : "не настроено",
      message: settings.gmailClientId ? "Gmail OAuth готов к настройке" : "Добавьте Google OAuth Client ID",
      name: "Gmail / Booksy",
      state: settings.gmailClientId ? "ok" : "warning",
    },
  ];
  const summary = items.reduce(
    (result, item) => ({
      ...result,
      [item.state]: (result[item.state] || 0) + 1,
    }),
    {off: 0, ok: 0, warning: 0},
  );

  return {
    items,
    summary,
  };
};
