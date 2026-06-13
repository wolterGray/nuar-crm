const SITE_MASTER_ALIASES: Record<string, string> = {
  max: "Максим",
  olha: "Ольга",
  helga: "Ольга",
  максим: "Максим",
  ольга: "Ольга",
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
    return String(employees[0]?.name ?? "");
  }

  const alias = SITE_MASTER_ALIASES[normalizeText(raw)];

  if (alias) {
    return alias;
  }

  const matched = employees.find(
    (employee) => normalizeText(employee.name) === normalizeText(raw),
  );

  return String(matched?.name ?? raw);
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
  const crmDate = normalizeBookingCrmDate(date);

  if (!inputDate || !crmDate) {
    return [];
  }

  const duration = Math.max(15, Number(durationMinutes) || 60);
  const step = Math.max(
    15,
    Number(slotStepMinutes ?? appSettings.calendarSlotMinutes) || 15,
  );
  const todayInput = now.toISOString().slice(0, 10);
  const isToday = inputDate === todayInput;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let activeEmployees = employees.filter(
    (employee) => String(employee.status ?? "") !== "Архив",
  );

  if (preferredMaster) {
    const resolvedMaster = resolveSiteBookingMaster(preferredMaster, activeEmployees);
    activeEmployees = activeEmployees.filter(
      (employee) => String(employee.name) === resolvedMaster,
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

  const slots: Array<{
    durationMinutes: number;
    endTime: string;
    master: string;
    startTime: string;
  }> = [];

  activeEmployees.forEach((employee) => {
    const master = String(employee.name ?? "");
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
            String(booking.preferred_master ?? ""),
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

  return slots.some(
    (slot) =>
      slot.startTime === normalizedTime &&
      (!resolvedMaster || slot.master === resolvedMaster),
  );
};
