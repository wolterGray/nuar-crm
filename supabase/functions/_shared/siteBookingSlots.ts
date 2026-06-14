const SITE_MASTER_ALIASES: Record<string, string> = {
  max: "Максим",
  olha: "Ольга",
  helga: "Ольга",
  максим: "Максим",
  ольга: "Ольга",
};

const DEFAULT_SITE_MASTERS = ["Ольга", "Максим"];

const SITE_BOOKING_SLOT_DEFAULTS: Record<string, number> = {
  max: 60,
  helga: 15,
  olha: 15,
  максим: 60,
  ольга: 15,
};

const normalizeEmployeeName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const resolveEmployeeSiteBookingSlotMinutes = (
  employee: Record<string, unknown> = {},
  appSettings: Record<string, unknown> = {},
) => {
  const configured = Number(employee.siteBookingSlotMinutes);

  if (Number.isFinite(configured) && configured >= 15) {
    return Math.max(15, Math.round(configured / 15) * 15);
  }

  const nameDefault =
    SITE_BOOKING_SLOT_DEFAULTS[normalizeEmployeeName(employee.name)];

  if (nameDefault) {
    return nameDefault;
  }

  return Math.max(15, Number(appSettings.calendarSlotMinutes) || 15);
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const resolveSiteBookingMaster = (
  preferredMaster = "",
  employees: Array<Record<string, unknown>> = [],
) => {
  const raw = String(preferredMaster ?? "").trim();

  if (!raw) {
    return "";
  }

  const alias = SITE_MASTER_ALIASES[normalizeText(raw)];

  if (alias) {
    return alias;
  }

  const matched = employees.find(
    (employee) => normalizeText(employee.name) === normalizeText(raw),
  );

  const matchedName = String(matched?.name ?? raw);
  const matchedAlias = SITE_MASTER_ALIASES[normalizeText(matchedName)];

  return matchedAlias || matchedName;
};

const toMinutes = (time: unknown) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

const toClockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const mergeIntervals = (intervals: Array<{start: number; end: number}>) => {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged.at(-1)!;

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({...current});
    }
  }

  return merged;
};

const roundUpToStep = (minutes: number, step: number) =>
  Math.ceil(minutes / step) * step;

const overlapsInterval = (
  start: number,
  end: number,
  interval: {start: number; end: number},
) => start < interval.end && end > interval.start;

const parseInputDate = (value: unknown) => {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
};

export const normalizeBookingInputDate = (value: unknown) => parseInputDate(value);

export const normalizeBookingCrmDate = (value: unknown) => {
  const inputDate = parseInputDate(value);

  if (!inputDate) {
    return "";
  }

  const [year, month, day] = inputDate.split("-");

  return `${day}.${month}.${year}`;
};

const getWarsawNow = (now = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const buildDefaultEmployees = (appSettings: Record<string, unknown>) =>
  DEFAULT_SITE_MASTERS.map((name) => ({
    name,
    shiftEnd: appSettings.workdayEnd || "22:00",
    shiftStart: appSettings.workdayStart || "08:00",
    siteBookingSlotMinutes: resolveEmployeeSiteBookingSlotMinutes(
      {name},
      appSettings,
    ),
  }));

const entryMatchesBookingDate = (entryDate: unknown, inputDate: string) =>
  normalizeBookingInputDate(entryDate) === inputDate;

const isBlockingCalendarEntry = (
  entry: Record<string, unknown>,
  inputDate: string,
) => {
  if (!entryMatchesBookingDate(entry.date, inputDate)) {
    return false;
  }

  const kind = String(entry.kind ?? "visit");

  if (kind === "visit") {
    return !["cancelled", "no_show"].includes(String(entry.status ?? ""));
  }

  if (kind === "reserved" || kind === "task") {
    return true;
  }

  return false;
};

const getEntryOccupiedInterval = (
  entry: Record<string, unknown>,
  step: number,
) => {
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
}: {
  appSettings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  date: string;
  durationMinutes?: number;
  employees?: Array<Record<string, unknown>>;
  now?: Date;
  pendingBookings?: Array<Record<string, unknown>>;
  preferredMaster?: string;
  slotStepMinutes?: number;
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
  const warsawNow = getWarsawNow(now);
  const isToday = inputDate === warsawNow.date;
  const currentMinutes = warsawNow.minutes;
  let activeEmployees = employees.filter(
    (employee) => String(employee.status ?? "") !== "Архив",
  );

  if (preferredMaster) {
    const resolvedMaster = resolveSiteBookingMaster(preferredMaster, activeEmployees);
    activeEmployees = activeEmployees.filter(
      (employee) =>
        resolveSiteBookingMaster(String(employee.name ?? ""), employees) ===
        resolvedMaster,
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

  const slots: Array<{
    durationMinutes: number;
    endTime: string;
    master: string;
    startTime: string;
  }> = [];

  activeEmployees.forEach((employee) => {
    const master = resolveSiteBookingMaster(String(employee.name ?? ""), employees);
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
            resolveSiteBookingMaster(String(entry.master ?? ""), employees) ===
              master,
        )
        .map((entry) => getEntryOccupiedInterval(entry, step)),
      ...pendingBookings
        .filter((booking) => {
          const bookingDate = normalizeBookingInputDate(booking.preferred_date);

          return (
            bookingDate === inputDate &&
            resolveSiteBookingMaster(String(booking.preferred_master ?? ""), employees) ===
              master &&
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
  appSettings = {},
  calendarEntries = [],
  date,
  durationMinutes = 60,
  employees = [],
  now = new Date(),
  pendingBookings = [],
  preferredMaster = "",
  preferredTime = "",
}: {
  appSettings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  date: string;
  durationMinutes?: number;
  employees?: Array<Record<string, unknown>>;
  now?: Date;
  pendingBookings?: Array<Record<string, unknown>>;
  preferredMaster?: string;
  preferredTime?: string;
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
