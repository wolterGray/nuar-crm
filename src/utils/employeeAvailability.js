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
