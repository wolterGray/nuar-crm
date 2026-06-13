import {resolveSiteBookingMaster, resolveSiteBookingService} from "./siteBooking.js";

export const WEEKDAY_OPTIONS = [
  {value: 1, label: "Пн", fullLabel: "Понедельник"},
  {value: 2, label: "Вт", fullLabel: "Вторник"},
  {value: 3, label: "Ср", fullLabel: "Среда"},
  {value: 4, label: "Чт", fullLabel: "Четверг"},
  {value: 5, label: "Пт", fullLabel: "Пятница"},
  {value: 6, label: "Сб", fullLabel: "Суббота"},
  {value: 0, label: "Вс", fullLabel: "Воскресенье"},
];

const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

export const normalizePremiumHoursRules = (rules) => {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule) => ({
      daysOfWeek: Array.isArray(rule?.daysOfWeek)
        ? rule.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6)
        : [],
      enabled: rule?.enabled !== false,
      endTime: String(rule?.endTime ?? "22:00").slice(0, 5),
      id: String(rule?.id ?? ""),
      label: String(rule?.label ?? "").trim(),
      percent: Math.max(0, Number(rule?.percent) || 0),
      startTime: String(rule?.startTime ?? "17:00").slice(0, 5),
    }))
    .filter((rule) => rule.percent > 0);
};

export const buildPremiumHoursRule = ({
  daysOfWeek = [5, 6, 0],
  enabled = true,
  endTime = "22:00",
  id = "",
  label = "",
  percent = 15,
  startTime = "17:00",
} = {}) => ({
  daysOfWeek,
  enabled,
  endTime,
  id: id || `premium-${Date.now()}`,
  label,
  percent,
  startTime,
});

export const getInputDateWeekday = (inputDate) => {
  const match = String(inputDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
};

export const isTimeWithinRange = (time, startTime, endTime) => {
  const value = toMinutes(String(time ?? "").slice(0, 5));
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  return value >= start && value < end;
};

export const findEmployeeForMaster = (master, employees = []) => {
  const canonicalMaster = resolveSiteBookingMaster(master, employees);

  return (
    employees.find(
      (employee) => resolveSiteBookingMaster(employee.name, employees) === canonicalMaster,
    ) ?? null
  );
};

export const getPremiumPercentForSlot = (employee, {date, time}) => {
  if (!employee?.premiumHoursEnabled) {
    return 0;
  }

  const weekday = getInputDateWeekday(date);
  const rules = normalizePremiumHoursRules(employee.premiumHoursRules);

  if (weekday === null || rules.length === 0) {
    return 0;
  }

  return rules.reduce((maxPercent, rule) => {
    if (!rule.enabled) {
      return maxPercent;
    }

    if (!rule.daysOfWeek.includes(weekday)) {
      return maxPercent;
    }

    if (!isTimeWithinRange(time, rule.startTime, rule.endTime)) {
      return maxPercent;
    }

    return Math.max(maxPercent, rule.percent);
  }, 0);
};

export const calculateSiteBookingPrice = ({
  basePrice,
  employee = null,
  date,
  time,
}) => {
  const base = Math.max(0, Math.round(Number(basePrice) || 0));
  const discountPercent = Math.max(
    0,
    Math.min(100, Number(employee?.siteDiscountPercent) || 0),
  );
  const premiumPercent = getPremiumPercentForSlot(employee, {date, time});
  const premiumAmount = Math.round(base * (premiumPercent / 100));
  const subtotal = base + premiumAmount;
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const finalPrice = Math.max(0, subtotal - discountAmount);

  return {
    basePrice: base,
    discountAmount,
    discountPercent,
    finalPrice,
    premiumAmount,
    premiumPercent,
    subtotal,
  };
};

export const resolveSiteBookingBasePrice = ({
  durationMinutes,
  serviceCatalog = [],
  serviceSlug = "",
  serviceName = "",
}) =>
  resolveSiteBookingService(
    {
      durationMinutes,
      serviceSlug,
      service_name: serviceName,
    },
    serviceCatalog,
  ).amount;

export const parseEmployeePricingFromForm = (form, editingEmployee = null) => {
  const siteDiscountPercent = Math.max(
    0,
    Math.min(100, Number(form.get("siteDiscountPercent")) || 0),
  );
  const premiumHoursEnabled = form.get("premiumHoursEnabled") === "on";
  const premiumDays = form
    .getAll("premiumHoursDays")
    .map(Number)
    .filter((day) => day >= 0 && day <= 6);
  const existingRule = editingEmployee?.premiumHoursRules?.[0];
  const premiumRule = buildPremiumHoursRule({
    daysOfWeek: premiumDays.length ? premiumDays : existingRule?.daysOfWeek ?? [5, 6, 0],
    enabled: premiumHoursEnabled,
    endTime: String(form.get("premiumHoursEnd") ?? existingRule?.endTime ?? "22:00"),
    id: existingRule?.id,
    label: existingRule?.label || "Премиум-часы",
    percent: Number(form.get("premiumHoursPercent")) || existingRule?.percent || 0,
    startTime: String(form.get("premiumHoursStart") ?? existingRule?.startTime ?? "17:00"),
  });

  return {
    premiumHoursEnabled,
    premiumHoursRules: normalizePremiumHoursRules([premiumRule]),
    siteDiscountPercent,
  };
};

export const attachPricingToSlots = ({
  date,
  durationMinutes,
  employees = [],
  serviceCatalog = [],
  serviceName = "",
  serviceSlug = "",
  slots = [],
}) => {
  const basePrice = resolveSiteBookingBasePrice({
    durationMinutes,
    serviceCatalog,
    serviceName,
    serviceSlug,
  });

  return slots.map((slot) => {
    const employee = findEmployeeForMaster(slot.master, employees);
    const pricing = calculateSiteBookingPrice({
      basePrice,
      date,
      employee,
      time: slot.startTime,
    });

    return {
      ...slot,
      ...pricing,
    };
  });
};
