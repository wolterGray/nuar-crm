const toMinutes = (value) => {
  const [hours = 0, minutes = 0] = String(value ?? "00:00").split(":").map(Number);
  return hours * 60 + minutes;
};

export const isQuietHours = (now = new Date(), settings = {}) => {
  if (!settings.quietHoursEnabled) {
    return false;
  }

  const start = toMinutes(settings.quietHoursStart ?? "22:00");
  const end = toMinutes(settings.quietHoursEnd ?? "08:00");
  const current = now.getHours() * 60 + now.getMinutes();

  if (start === end) {
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
};

export const applyQuietHoursFilter = (alerts, settings = {}, now = new Date()) => {
  if (!isQuietHours(now, settings)) {
    return alerts;
  }

  return alerts.filter((alert) => alert.priority === "critical");
};

export const shouldShowSmartVisitPopup = (
  differenceMinutes,
  settings = {},
  now = new Date(),
) => {
  if (!isQuietHours(now, settings)) {
    return true;
  }

  return differenceMinutes <= 0;
};
