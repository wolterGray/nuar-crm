import {resolveSiteBookingMaster} from "./siteBookingSlots.ts";

type EmployeeRecord = Record<string, unknown>;
type PremiumHoursRule = {
  daysOfWeek?: number[];
  enabled?: boolean;
  endTime?: string;
  label?: string;
  percent?: number;
  startTime?: string;
};

const toMinutes = (time: unknown) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);

  return hours * 60 + minutes;
};

export const normalizePremiumHoursRules = (rules: unknown) => {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule) => {
      const record = (rule ?? {}) as PremiumHoursRule;

      return {
        daysOfWeek: Array.isArray(record.daysOfWeek)
          ? record.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6)
          : [],
        enabled: record.enabled !== false,
        endTime: String(record.endTime ?? "22:00").slice(0, 5),
        label: String(record.label ?? "").trim(),
        percent: Math.max(0, Number(record.percent) || 0),
        startTime: String(record.startTime ?? "17:00").slice(0, 5),
      };
    })
    .filter((rule) => rule.percent > 0);
};

const getInputDateWeekday = (inputDate: string) => {
  const match = String(inputDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay();
};

const isTimeWithinRange = (time: string, startTime: string, endTime: string) => {
  const value = toMinutes(String(time ?? "").slice(0, 5));
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  return value >= start && value < end;
};

export const findEmployeeForMaster = (
  master: string,
  employees: EmployeeRecord[] = [],
) => {
  const canonicalMaster = resolveSiteBookingMaster(master, employees);

  return (
    employees.find(
      (employee) =>
        resolveSiteBookingMaster(String(employee.name ?? ""), employees) ===
        canonicalMaster,
    ) ?? null
  );
};

export const getPremiumPercentForSlot = (
  employee: EmployeeRecord | null,
  {date, time}: {date: string; time: string},
) => {
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
}: {
  basePrice: number;
  employee?: EmployeeRecord | null;
  date: string;
  time: string;
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

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const resolveSiteBookingBasePrice = ({
  durationMinutes,
  serviceCatalog = [],
  serviceSlug = "",
  serviceName = "",
}: {
  durationMinutes: number;
  serviceCatalog?: Array<Record<string, unknown>>;
  serviceSlug?: string;
  serviceName?: string;
}) => {
  const slug = String(serviceSlug ?? "").trim();
  const name = String(serviceName ?? "").trim();
  const crmService = serviceCatalog.find((service) => {
    const normalizedName = normalizeText(service.name);

    return normalizedName === normalizeText(name) || slug && normalizedName.includes(normalizeText(slug.replaceAll("-", " ")));
  });
  const variant =
    (crmService?.variants as Array<Record<string, unknown>> | undefined)?.find(
      (item) => Number(item.duration) === Number(durationMinutes),
    ) ??
    (crmService?.variants as Array<Record<string, unknown>> | undefined)?.[0];

  return Math.max(0, Math.round(Number(variant?.price ?? crmService?.price ?? 0)));
};

export const attachPricingToSlots = ({
  date,
  durationMinutes,
  employees = [],
  serviceCatalog = [],
  serviceName = "",
  serviceSlug = "",
  slots = [],
}: {
  date: string;
  durationMinutes: number;
  employees?: EmployeeRecord[];
  serviceCatalog?: Array<Record<string, unknown>>;
  serviceName?: string;
  serviceSlug?: string;
  slots?: Array<Record<string, unknown>>;
}) => {
  const basePrice = resolveSiteBookingBasePrice({
    durationMinutes,
    serviceCatalog,
    serviceName,
    serviceSlug,
  });

  return slots.map((slot) => {
    const employee = findEmployeeForMaster(String(slot.master ?? ""), employees);
    const pricing = calculateSiteBookingPrice({
      basePrice,
      date,
      employee,
      time: String(slot.startTime ?? ""),
    });

    return {
      ...slot,
      ...pricing,
    };
  });
};
