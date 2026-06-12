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

export const buildTodayFreeSlots = ({
  appSettings = {},
  calendarEntries = [],
  employees = [],
  minSlotMinutes = 30,
  now = new Date(),
  today,
}) => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = Math.max(
    minSlotMinutes,
    Number(appSettings.calendarSlotMinutes) || 15,
  );
  const freeSlots = [];

  employees.forEach((employee) => {
    const master = employee.name;
    const shiftStart = toMinutes(
      employee.shiftStart || appSettings.workdayStart || "08:00",
    );
    const shiftEnd = toMinutes(
      employee.shiftEnd || appSettings.workdayEnd || "22:00",
    );
    const windowStart = Math.max(shiftStart, currentMinutes);
    const windowEnd = shiftEnd;

    if (windowStart >= windowEnd) {
      return;
    }

    const occupied = calendarEntries
      .filter(
        (entry) =>
          entry.kind === "visit" &&
          entry.date === today &&
          entry.master === master &&
          !["cancelled", "no_show"].includes(String(entry.status ?? "")),
      )
      .map((entry) => ({
        start: toMinutes(entry.time),
        end: toMinutes(entry.time) + Math.max(Number(entry.duration) || 0, slotMinutes),
      }));

    const merged = mergeIntervals(occupied);
    let cursor = windowStart;

    merged.forEach((interval) => {
      if (interval.start > cursor) {
        const durationMinutes = interval.start - cursor;

        if (durationMinutes >= slotMinutes) {
          freeSlots.push({
            durationMinutes,
            endTime: toClockTime(interval.start),
            master,
            startTime: toClockTime(cursor),
          });
        }
      }

      cursor = Math.max(cursor, interval.end);
    });

    if (windowEnd - cursor >= slotMinutes) {
      freeSlots.push({
        durationMinutes: windowEnd - cursor,
        endTime: toClockTime(windowEnd),
        master,
        startTime: toClockTime(cursor),
      });
    }
  });

  return freeSlots.sort((left, right) => {
    const masterDiff = String(left.master).localeCompare(String(right.master), "ru");

    if (masterDiff !== 0) {
      return masterDiff;
    }

    return toMinutes(left.startTime) - toMinutes(right.startTime);
  });
};
