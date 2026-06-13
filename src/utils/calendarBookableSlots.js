import {formatAppDate, INPUT_DATE_FORMAT, parseAppDate} from "./dateUtils.js";
import {resolveSiteBookingMaster} from "./siteBooking.js";

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

export const normalizeBookingInputDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : "";
};

export const normalizeBookingCrmDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed) : "";
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
  const crmDate = normalizeBookingCrmDate(date);

  if (!inputDate || !crmDate) {
    return [];
  }

  const duration = Math.max(15, Number(durationMinutes) || 60);
  const step = Math.max(
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
      (employee) => employee.name === resolvedMaster,
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

  const slots = [];

  activeEmployees.forEach((employee) => {
    const master = employee.name;
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
            entry?.kind === "visit" &&
            entry.date === crmDate &&
            entry.master === master &&
            !["cancelled", "no_show"].includes(String(entry.status ?? "")),
        )
        .map((entry) => ({
          start: toMinutes(entry.time),
          end:
            toMinutes(entry.time) +
            Math.max(Number(entry.duration) || 0, step),
        })),
      ...pendingBookings
        .filter((booking) => {
          const bookingDate = normalizeBookingInputDate(booking.preferred_date);
          const bookingMaster = resolveSiteBookingMaster(
            booking.preferred_master,
            employees,
          );

          return (
            bookingDate === inputDate &&
            bookingMaster === master &&
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

  return slots.some(
    (slot) =>
      slot.startTime === normalizedTime &&
      (!resolvedMaster || slot.master === resolvedMaster),
  );
};
