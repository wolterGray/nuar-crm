import {formatAppDate, INPUT_DATE_FORMAT, parseAppDate} from "./dateUtils.js";
import {resolveSiteBookingMaster} from "./siteBooking.js";

const DEFAULT_SITE_MASTERS = ["Ольга", "Максим"];

const SITE_BOOKING_SLOT_DEFAULTS = {
  max: 60,
  helga: 15,
  olha: 15,
  максим: 60,
  ольга: 15,
};

const normalizeEmployeeName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const resolveEmployeeSiteBookingSlotMinutes = (
  employee = {},
  appSettings = {},
) => {
  const configured = Number(employee.siteBookingSlotMinutes);

  if (Number.isFinite(configured) && configured >= 15) {
    return Math.max(15, Math.round(configured / 15) * 15);
  }

  const nameDefault = SITE_BOOKING_SLOT_DEFAULTS[normalizeEmployeeName(employee.name)];

  if (nameDefault) {
    return nameDefault;
  }

  return Math.max(15, Number(appSettings.calendarSlotMinutes) || 15);
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const mergeIntervals = (intervals) => {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged.at(-1);

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({...current});
    }
  }

  return merged;
};

const roundUpToStep = (minutes, step) =>
  Math.ceil(minutes / step) * step;

const overlapsInterval = (start, end, interval) =>
  start < interval.end && end > interval.start;

const buildDefaultEmployees = (appSettings) =>
  DEFAULT_SITE_MASTERS.map((name) => ({
    name,
    shiftEnd: appSettings.workdayEnd || "22:00",
    shiftStart: appSettings.workdayStart || "08:00",
    siteBookingSlotMinutes: resolveEmployeeSiteBookingSlotMinutes({name}, appSettings),
  }));

export const normalizeBookingInputDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : "";
};

export const normalizeBookingCrmDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed) : "";
};

const entryMatchesBookingDate = (entryDate, inputDate) =>
  normalizeBookingInputDate(entryDate) === inputDate;

const isBlockingCalendarEntry = (entry, inputDate) => {
  if (!entryMatchesBookingDate(entry?.date, inputDate)) {
    return false;
  }

  const kind = String(entry?.kind ?? "visit");

  if (kind === "visit") {
    return !["cancelled", "no_show"].includes(String(entry.status ?? ""));
  }

  if (kind === "reserved" || kind === "task") {
    return true;
  }

  return false;
};

const getEntryOccupiedInterval = (entry, step) => {
  const start = toMinutes(entry.time);
  const duration = Number(entry.duration) || 0;
  let end = start + Math.max(duration, step);

  if (duration <= 0 && entry.endTime) {
    end = Math.max(start + step, toMinutes(entry.endTime));
  }

  return {start, end};
};

export const buildBookableSlots = ({
  appSettings = {},
  calendarEntries = [],
  date,
  durationMinutes = 60,
  employees = [],
  now = new Date(),
  pendingBookings = [],
  preferredMaster = "",
  slotStepMinutes,
}) => {
  const inputDate = normalizeBookingInputDate(date);

  if (!inputDate) {
    return [];
  }

  const duration = Math.max(15, Number(durationMinutes) || 60);
  const fallbackStep = Math.max(
    15,
    Number(slotStepMinutes ?? appSettings.calendarSlotMinutes) || 15,
  );
  const todayInput = formatAppDate(now, INPUT_DATE_FORMAT);
  const isToday = inputDate === todayInput;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let activeEmployees = employees.filter(
    (employee) => employee.status !== "Архив",
  );

  if (preferredMaster) {
    const resolvedMaster = resolveSiteBookingMaster(
      preferredMaster,
      activeEmployees,
    );
    activeEmployees = activeEmployees.filter(
      (employee) =>
        resolveSiteBookingMaster(employee.name, employees) === resolvedMaster,
    );

    if (activeEmployees.length === 0 && resolvedMaster) {
      activeEmployees = [
        {
          name: resolvedMaster,
          shiftEnd: appSettings.workdayEnd || "22:00",
          shiftStart: appSettings.workdayStart || "08:00",
        },
      ];
    }
  }

  if (activeEmployees.length === 0) {
    activeEmployees = buildDefaultEmployees(appSettings);
  }

  const slots = [];

  activeEmployees.forEach((employee) => {
    const master = resolveSiteBookingMaster(employee.name, employees);
    const step = Math.max(
      15,
      Number(
        slotStepMinutes ??
          resolveEmployeeSiteBookingSlotMinutes(employee, appSettings),
      ) || fallbackStep,
    );
    const shiftStart = toMinutes(
      employee.shiftStart || appSettings.workdayStart || "08:00",
    );
    const shiftEnd = toMinutes(
      employee.shiftEnd || appSettings.workdayEnd || "22:00",
    );
    const windowStart = isToday
      ? Math.max(shiftStart, roundUpToStep(currentMinutes, step))
      : shiftStart;
    const windowEnd = shiftEnd;

    if (windowStart + duration > windowEnd) {
      return;
    }

    const occupied = mergeIntervals([
      ...calendarEntries
        .filter(
          (entry) =>
            isBlockingCalendarEntry(entry, inputDate) &&
            resolveSiteBookingMaster(entry.master, employees) === master,
        )
        .map((entry) => getEntryOccupiedInterval(entry, step)),
      ...pendingBookings
        .filter((booking) => {
          const bookingDate = normalizeBookingInputDate(booking.preferred_date);

          return (
            bookingDate === inputDate &&
            resolveSiteBookingMaster(booking.preferred_master, employees) === master &&
            String(booking.status ?? "pending") === "pending"
          );
        })
        .map((booking) => ({
          start: toMinutes(String(booking.preferred_time ?? "").slice(0, 5)),
          end:
            toMinutes(String(booking.preferred_time ?? "").slice(0, 5)) +
            Math.max(Number(booking.duration_minutes) || duration, step),
        })),
    ]);

    for (
      let cursor = windowStart;
      cursor + duration <= windowEnd;
      cursor += step
    ) {
      const slotEnd = cursor + duration;
      const isFree = !occupied.some((interval) =>
        overlapsInterval(cursor, slotEnd, interval),
      );

      if (isFree) {
        slots.push({
          durationMinutes: duration,
          endTime: toClockTime(slotEnd),
          master,
          startTime: toClockTime(cursor),
        });
      }
    }
  });

  return slots.sort((left, right) => {
    const timeDiff = toMinutes(left.startTime) - toMinutes(right.startTime);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return String(left.master).localeCompare(String(right.master), "ru");
  });
};

export const isBookableSlotAvailable = ({
  appSettings,
  calendarEntries,
  date,
  durationMinutes,
  employees,
  now,
  pendingBookings,
  preferredMaster,
  preferredTime,
}) => {
  const slots = buildBookableSlots({
    appSettings,
    calendarEntries,
    date,
    durationMinutes,
    employees,
    now,
    pendingBookings,
    preferredMaster,
  });
  const normalizedTime = String(preferredTime ?? "").trim().slice(0, 5);
  const resolvedMaster = resolveSiteBookingMaster(preferredMaster, employees);

  return slots.some((slot) => {
    if (slot.startTime !== normalizedTime) {
      return false;
    }

    if (!resolvedMaster) {
      return true;
    }

    return resolveSiteBookingMaster(slot.master, employees) === resolvedMaster;
  });
};
