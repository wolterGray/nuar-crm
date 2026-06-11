import {getTodayInput} from "./dateHelpers.js";

export const getMinutesFromTime = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

export const isCalendarVisitPlanned = (entry, now = new Date()) => {
  if (["completed", "cancelled", "no_show"].includes(entry.status)) {
    return false;
  }

  const today = getTodayInput();

  if ((entry.date || today) < today) {
    return false;
  }

  if ((entry.date || today) > today) {
    return true;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes > nowMinutes;
};

export const isCalendarVisitCompleted = (entry, now = new Date()) => {
  if (
    entry.kind !== "visit" ||
    ["cancelled", "no_show"].includes(entry.status)
  ) {
    return false;
  }

  if (entry.status === "completed") {
    return true;
  }

  const today = getTodayInput();

  if ((entry.date || today) < today) {
    return true;
  }

  if ((entry.date || today) > today) {
    return false;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes <= nowMinutes;
};
