export const getEndOfToday = (now = new Date()) => {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getSnoozeUntilDays = (days, now = new Date()) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

export const isAlertSnoozed = (alertId, snoozes = {}, now = new Date()) => {
  const until = snoozes[alertId];

  if (!until) {
    return false;
  }

  return new Date(until).getTime() > now.getTime();
};

export const pruneExpiredSnoozes = (snoozes = {}, now = new Date()) => {
  const nextSnoozes = {};
  const nowMs = now.getTime();

  Object.entries(snoozes).forEach(([alertId, until]) => {
    if (new Date(until).getTime() > nowMs) {
      nextSnoozes[alertId] = until;
    }
  });

  return nextSnoozes;
};

export const isAlertHidden = (
  alertId,
  dismissedIds = [],
  snoozes = {},
  now = new Date(),
) => dismissedIds.includes(alertId) || isAlertSnoozed(alertId, snoozes, now);
