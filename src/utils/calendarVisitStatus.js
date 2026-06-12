import {formatAppDate, INPUT_DATE_FORMAT} from "./dateUtils.js";

export const getMinutesFromTime = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const getTodayFromNow = (now) => formatAppDate(now, INPUT_DATE_FORMAT);

export const isCalendarVisitPlanned = (entry, now = new Date()) => {
  if (["completed", "cancelled", "no_show"].includes(entry.status)) {
    return false;
  }

  const today = getTodayFromNow(now);
  const entryDate = entry.date || today;

  if (entryDate < today) {
    return false;
  }

  if (entryDate > today) {
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

  const today = getTodayFromNow(now);
  const entryDate = entry.date || today;

  if (entryDate < today) {
    return true;
  }

  if (entryDate > today) {
    return false;
  }

  const endMinutes =
    getMinutesFromTime(entry.time) + (Number(entry.duration) || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return endMinutes <= nowMinutes;
};
