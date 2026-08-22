import {formatAppDate, INPUT_DATE_FORMAT, parseAppDate} from "./dateUtils.js";

export const WEEKDAY_OPTIONS = [
  {label: "Пн", value: 1},
  {label: "Вт", value: 2},
  {label: "Ср", value: 3},
  {label: "Чт", value: 4},
  {label: "Пт", value: 5},
  {label: "Сб", value: 6},
  {label: "Вс", value: 0},
];

export const ALL_WORKING_DAYS = WEEKDAY_OPTIONS.map((day) => day.value);

const readEmployeePayload = (employee = {}) =>
  employee?.payload && typeof employee.payload === "object" ? employee.payload : {};

const isTimeValue = (value) => /^\d{2}:\d{2}$/.test(String(value ?? ""));

export const normalizeWorkingDays = (value) => {
  if (!Array.isArray(value)) {
    return ALL_WORKING_DAYS;
  }

  const days = [...new Set(value.map(Number).filter((day) => day >= 0 && day <= 6))];
  return days.length ? days : ALL_WORKING_DAYS;
};

export const normalizeBlockedDates = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((date) => {
          const parsed = parseAppDate(date);
          return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : "";
        })
        .filter(Boolean),
    ),
  ].sort();
};

export const getEmployeeWorkingDays = (employee = {}) =>
  normalizeWorkingDays(
    employee.workingDaysOfWeek ?? readEmployeePayload(employee).workingDaysOfWeek,
  );

export const getEmployeeBlockedDates = (employee = {}) =>
  normalizeBlockedDates(
    employee.bookingBlockedDates ?? readEmployeePayload(employee).bookingBlockedDates,
  );

export const normalizeDailyShifts = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([day, shift]) => {
        const dayNumber = Number(day);
        const start = String(shift?.start ?? "").trim();
        const end = String(shift?.end ?? "").trim();

        if (dayNumber < 0 || dayNumber > 6 || !isTimeValue(start) || !isTimeValue(end)) {
          return null;
        }

        return [String(dayNumber), {end, start}];
      })
      .filter(Boolean),
  );
};

export const getEmployeeDailyShifts = (employee = {}) =>
  normalizeDailyShifts(
    employee.dailyShifts ?? employee.shifts ?? readEmployeePayload(employee).dailyShifts ?? readEmployeePayload(employee).shifts,
  );

export const getEmployeeShiftForDate = (
  employee = {},
  date,
  fallback = {},
) => {
  const parsed = parseAppDate(date);
  const defaultStart = employee.shiftStart || fallback.start || fallback.shiftStart || "08:00";
  const defaultEnd = employee.shiftEnd || fallback.end || fallback.shiftEnd || "22:00";

  if (!parsed) {
    return {end: defaultEnd, start: defaultStart};
  }

  const dailyShift = getEmployeeDailyShifts(employee)[String(parsed.getDay())];
  return {
    end: dailyShift?.end || defaultEnd,
    start: dailyShift?.start || defaultStart,
  };
};

export const parseBlockedDatesText = (value = "") =>
  normalizeBlockedDates(
    String(value ?? "")
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const isEmployeeAvailableOnDate = (employee = {}, date) => {
  const parsed = parseAppDate(date);

  if (!parsed) {
    return true;
  }

  const inputDate = formatAppDate(parsed, INPUT_DATE_FORMAT);
  const weekday = parsed.getDay();

  return (
    getEmployeeWorkingDays(employee).includes(weekday) &&
    !getEmployeeBlockedDates(employee).includes(inputDate)
  );
};

export const getEmployeeUnavailableReason = (employee = {}, date) => {
  const parsed = parseAppDate(date);

  if (!parsed) {
    return "";
  }

  const inputDate = formatAppDate(parsed, INPUT_DATE_FORMAT);
  if (getEmployeeBlockedDates(employee).includes(inputDate)) {
    return `${employee.name || "Сотрудник"} недоступен ${inputDate}`;
  }

  if (!getEmployeeWorkingDays(employee).includes(parsed.getDay())) {
    return `${employee.name || "Сотрудник"} не работает в этот день недели`;
  }

  return "";
};
