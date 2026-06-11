import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isValid,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {ru} from "date-fns/locale";

export const APP_DATE_FORMAT = "dd.MM.yyyy";
export const INPUT_DATE_FORMAT = "yyyy-MM-dd";

export const parseAppDate = (value) => {
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const date = String(value ?? "").trim();

  if (!date) {
    return null;
  }

  const parsedDate = date.includes("-")
    ? parseISO(date)
    : parse(date, APP_DATE_FORMAT, new Date());

  return isValid(parsedDate) ? parsedDate : null;
};

export const formatAppDate = (value, outputFormat = APP_DATE_FORMAT) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? format(parsedDate, outputFormat, {locale: ru}) : "";
};

export const getStartOfDay = (value) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? startOfDay(parsedDate) : null;
};

export const getEndOfDay = (value) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? endOfDay(parsedDate) : null;
};

export const isVisitInPeriod = (visit, startDate, endDate) => {
  const visitDate = parseAppDate(visit?.date);
  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  if (!visitDate || !start || !end) {
    return false;
  }

  return !isBefore(visitDate, start) && !isAfter(visitDate, end);
};

export const isFutureVisitDate = (visit, now = new Date()) => {
  const visitDate = parseAppDate(visit?.date);

  if (!visitDate) {
    return false;
  }

  const [hours = 23, minutes = 59] = String(visit?.time || "23:59")
    .split(":")
    .map(Number);
  visitDate.setHours(
    Number.isFinite(hours) ? hours : 23,
    Number.isFinite(minutes) ? minutes : 59,
    0,
    0,
  );

  return isAfter(visitDate, now);
};

export const getPeriodDays = (startDate, endDate) => {
  const start = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);

  if (!start || !end || isAfter(start, end)) {
    return [];
  }

  return eachDayOfInterval({start, end}).map((date) =>
    format(date, INPUT_DATE_FORMAT),
  );
};

export const groupByDay = (items, getDate = (item) => item.date) =>
  items.reduce((groups, item) => {
    const key = formatAppDate(getDate(item), INPUT_DATE_FORMAT);

    if (!key) {
      return groups;
    }

    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});

export const groupByWeek = (items, getDate = (item) => item.date) =>
  items.reduce((groups, item) => {
    const parsedDate = parseAppDate(getDate(item));

    if (!parsedDate) {
      return groups;
    }

    const weekStart = format(
      startOfWeek(parsedDate, {weekStartsOn: 1}),
      INPUT_DATE_FORMAT,
    );

    groups[weekStart] = [...(groups[weekStart] ?? []), item];
    return groups;
  }, {});

export const getStartOfWeek = (value) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? startOfWeek(parsedDate, {weekStartsOn: 1}) : null;
};

export const getEndOfWeek = (value) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? endOfWeek(parsedDate, {weekStartsOn: 1}) : null;
};

export const getStartOfMonth = (value = new Date()) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? startOfMonth(parsedDate) : startOfMonth(new Date());
};

export const getEndOfMonth = (value = new Date()) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? endOfMonth(parsedDate) : endOfMonth(new Date());
};

export const shiftAppDate = (value, days) => {
  const parsedDate = parseAppDate(value);

  return parsedDate ? format(addDays(parsedDate, days), INPUT_DATE_FORMAT) : "";
};

export const isSameAppDay = (firstDate, secondDate) => {
  const first = parseAppDate(firstDate);
  const second = parseAppDate(secondDate);

  return Boolean(first && second && isSameDay(first, second));
};

export const getVisitDateTime = (visit) => {
  const visitDate = parseAppDate(visit?.date);

  if (!visitDate) {
    return null;
  }

  const [hours = 0, minutes = 0] = String(visit?.time || "00:00")
    .split(":")
    .map(Number);
  visitDate.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );

  return visitDate;
};

export const getUpcomingVisitsWithinHours = (
  entries,
  hours = 3,
  now = new Date(),
  filter = () => true,
) => {
  const limitMs = hours * 60 * 60 * 1000;

  return entries
    .filter((entry) => {
      if (!filter(entry)) {
        return false;
      }

      const dateTime = getVisitDateTime(entry);

      if (!dateTime) {
        return false;
      }

      const delta = dateTime.getTime() - now.getTime();

      return delta > 0 && delta <= limitMs;
    })
    .sort(
      (first, second) =>
        getVisitDateTime(first).getTime() - getVisitDateTime(second).getTime(),
    );
};

export const getVisitDurationMinutes = (startVisit, endVisit) => {
  const start = parseAppDate(startVisit?.date);
  const end = parseAppDate(endVisit?.date);

  if (!start || !end) {
    return 0;
  }

  return differenceInMinutes(end, start);
};
