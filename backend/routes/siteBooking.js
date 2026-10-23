const crypto = require('crypto');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requirePermission, PERMISSIONS } = require('../middleware/auth');
const { publicBookingLimiter } = require('../middleware/rateLimiter');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { queueBusinessPushDeliveries } = require('../services/businessPushService');
const {findOrCreateSiteBookingClient} = require('../services/siteBookingClientService');
const { upsertNotificationEvent } = require('../services/notificationEventsService');
const { telegramDigest } = require('../services/telegramService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { ensureSiteBookingTables } = require('../utils/siteCmsTables');

const prisma = new PrismaClient();
const publicSiteBookingRouter = express.Router();
const siteBookingRouter = express.Router();

const DEFAULT_MASTERS = ['Ольга', 'Максим'];
const DEFAULT_WORKDAY_START = '08:00';
const DEFAULT_WORKDAY_END = '22:00';
const DEFAULT_SLOT_STEP = 15;
const SITE_SERVICE_PRICE_FALLBACKS = [
  { slug: 'masaz-klasyczny', title: 'Masaż klasyczny', time: [60, 75, 90, 120], price: [200, 250, 280, 360], priceTopMaster: [310, 350, 370, 470] },
  { slug: 'masaz-sportowy', title: 'Masaż sportowy', time: [60, 75, 90, 120], price: [200, 250, 280, 360], priceTopMaster: [310, 350, 370, 470] },
  { slug: 'masaz-relaksacyjny', title: 'Masaż relaksacyjny', time: [60, 75, 90, 120], price: [200, 250, 280, 360], priceTopMaster: [310, 350, 370, 470] },
  { slug: 'masaz-limfatyczny', title: 'Masaż limfatyczny', time: [60, 75, 90, 120], price: [200, 250, 280, 360], priceTopMaster: [310, 350, 370, 470] },
  { slug: 'masaz-antycellulitowy', title: 'Masaż antycellulitowy', time: [60, 75, 90, 120], price: [200, 250, 280, 360], priceTopMaster: [310, 350, 370, 470] },
  { slug: 'masaz-twarzy-i-glowy', title: 'Masaż twarzy i głowy', time: [60], price: [330], priceTopMaster: [330] },
  { slug: 'masaz-autorski', title: 'Masaż autorski', time: [90, 120], price: [490, 590], priceTopMaster: [490, 590] },
  { slug: 'masaz-dla-dwojga', title: 'Masaż dla dwojga', time: [60, 90], price: [500, 650], priceTopMaster: [500, 650] },
];

const SITE_MASTER_ALIASES = {
  max: 'Максим',
  olha: 'Ольга',
  olga: 'Ольга',
  helga: 'Ольга',
  максим: 'Максим',
  ольга: 'Ольга',
};

const SELECT_SITE_BOOKING = `
  id, client_name, client_phone, client_email, service_slug, service_name,
  preferred_date, preferred_time, preferred_master, duration_minutes, status,
  note, linked_calendar_entry_id, created_at, updated_at
`;

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('ё', 'е');

const toMinutes = (time) => {
  const [hours = 0, minutes = 0] = String(time ?? '00:00').split(':').map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const cleanString = (value) => String(value ?? '').trim();

const firstNonEmpty = (...values) => values.map(cleanString).find(Boolean) || '';

const isInputDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));

const normalizePhone = (value) => String(value ?? '').replace(/[^\d+]/g, '');

const getWarsawNow = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const addMinutesToTime = (time, minutesToAdd) => {
  const total = Math.min(24 * 60 - 1, Math.max(0, toMinutes(time) + Math.max(1, Number(minutesToAdd) || 0)));
  return toClockTime(total);
};

const normalizeWorkingDays = (value) => {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5, 6, 0];
  return [
    ...new Set(
      value
        .map((day) => {
          const num = Number(day);
          return num === 7 ? 0 : num;
        })
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ];
};

const normalizeBlockedDates = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter(isInputDate))].sort();
};

const isTimeValue = (value) => /^\d{2}:\d{2}$/.test(String(value ?? ''));

const normalizeDailyShifts = (value) => {
  if (!value || typeof value !== 'object') return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([day, shift]) => {
        const dayNumber = Number(day);
        const start = cleanString(shift?.start);
        const end = cleanString(shift?.end);

        if (dayNumber < 0 || dayNumber > 6 || !isTimeValue(start) || !isTimeValue(end)) {
          return null;
        }

        return [String(dayNumber), { end, start }];
      })
      .filter(Boolean),
  );
};

const getEmployeeShiftForDate = (employee, date) => {
  const defaultStart = cleanString(employee?.shiftStart) || DEFAULT_WORKDAY_START;
  const defaultEnd = cleanString(employee?.shiftEnd) || DEFAULT_WORKDAY_END;

  if (!isInputDate(date)) return { end: defaultEnd, start: defaultStart };

  const dailyShift = normalizeDailyShifts(employee?.dailyShifts)[String(new Date(`${date}T12:00:00`).getDay())];
  return {
    end: dailyShift?.end || defaultEnd,
    start: dailyShift?.start || defaultStart,
  };
};

const isEmployeeAvailableOnDate = (employee, date) => {
  if (!isInputDate(date)) return true;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return (
    normalizeWorkingDays(employee?.workingDaysOfWeek).includes(weekday) &&
    !normalizeBlockedDates(employee?.bookingBlockedDates).includes(date)
  );
};

const validationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const handleRouteError = async (req, res, error, context = {}) => {
  const response = getHttpErrorResponse(error);
  console.error('Site booking API error:', error);
  await recordErrorEvent(prisma, {
    context: {
      ...context,
      path: req.originalUrl,
    },
    error,
    message: error.message,
    source: 'site-booking',
  }).catch(() => {});
  res.status(response.status).json({ success: false, error: response.message });
};

const resolveMaster = (preferredMaster = '', employees = []) => {
  const raw = cleanString(preferredMaster);
  if (!raw) return cleanString(employees[0]?.name) || '';

  const matched = employees.find((employee) => normalizeText(employee.name) === normalizeText(raw));
  if (matched) return cleanString(matched.name);

  const canonicalName = SITE_MASTER_ALIASES[normalizeText(raw)];
  if (canonicalName) {
    const aliasedEmployee = employees.find(
      (employee) =>
        normalizeText(employee.name) === normalizeText(canonicalName) ||
        SITE_MASTER_ALIASES[normalizeText(employee.name)] === canonicalName,
    );
    if (aliasedEmployee) return cleanString(aliasedEmployee.name);
  }

  return raw;
};

const readPayload = (row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {});

const toPublicEmployee = (row) => {
  const payload = readPayload(row);
  const pricing = row?.pricing && typeof row.pricing === 'object' ? row.pricing : {};
  const name = cleanString(row?.name ?? payload.name);
  return {
    id: row?.id,
    name,
    bookingBlockedDates: normalizeBlockedDates(payload.bookingBlockedDates),
    premiumHoursEnabled: pricing.premiumHoursEnabled === true || payload.premiumHoursEnabled === true,
    premiumHoursRules: Array.isArray(pricing.premiumHoursRules)
      ? pricing.premiumHoursRules
      : Array.isArray(payload.premiumHoursRules)
        ? payload.premiumHoursRules
        : [],
    dailyShifts: normalizeDailyShifts(payload.dailyShifts ?? row?.shifts),
    shiftEnd: cleanString(row?.shiftEnd ?? payload.shiftEnd) || DEFAULT_WORKDAY_END,
    shiftStart: cleanString(row?.shiftStart ?? payload.shiftStart) || DEFAULT_WORKDAY_START,
    siteDiscountPercent: Number(pricing.siteDiscountPercent ?? payload.siteDiscountPercent) || 0,
    siteVisible: row?.siteVisible !== false && payload.siteBookingEnabled !== false,
    role: cleanString(row?.role ?? payload.role),
    status: cleanString(row?.status ?? payload.status),
    workingDaysOfWeek: normalizeWorkingDays(payload.workingDaysOfWeek),
  };
};

const toPublicService = (row) => {
  const payload = readPayload(row);
  return {
    id: row?.id,
    name: cleanString(row?.name ?? payload.name),
    buffers: row?.buffers && typeof row.buffers === 'object' ? row.buffers : {},
    payload,
    price: Number(row?.price) || 0,
    siteVisible: row?.siteVisible !== false && payload.siteBookingEnabled !== false,
    status: cleanString(row?.status ?? payload.status),
    variants: Array.isArray(row?.variants) ? row.variants : Array.isArray(payload.variants) ? payload.variants : [],
  };
};

const cleanServiceTitle = (name) =>
  normalizeText(name)
    .replace(/\s*\((top[- ]?)?master\)/i, '')
    .trim();

const isTopMasterEmployee = (employee) =>
  /top/i.test(employee?.role ?? '') ||
  /top/i.test(employee?.name ?? '') ||
  SITE_MASTER_ALIASES[normalizeText(employee?.name)] === 'Ольга';

const getCatalogService = ({ serviceName, serviceSlug }) => {
  const normalizedSlug = normalizeText(serviceSlug);
  const normalizedName = cleanServiceTitle(serviceName);
  const bySlug = SITE_SERVICE_PRICE_FALLBACKS.find((item) => normalizeText(item.slug) === normalizedSlug);
  if (bySlug) return bySlug;

  const byTitle = SITE_SERVICE_PRICE_FALLBACKS.find((item) => {
    const title = cleanServiceTitle(item.title);
    return normalizedName === title || normalizedName.includes(title) || title.includes(normalizedName);
  });
  if (byTitle) return byTitle;

  const aliases = [
    { pattern: /(?:twarzy|lica|лиц|face|glow)/i, slug: 'masaz-twarzy-i-glowy' },
    { pattern: /(?:sport|спорт)/i, slug: 'masaz-sportowy' },
    { pattern: /(?:klasycz|klass|классич)/i, slug: 'masaz-klasyczny' },
    { pattern: /(?:relaks|relax|релакс)/i, slug: 'masaz-relaksacyjny' },
    { pattern: /(?:limfat|lymph|лимфат)/i, slug: 'masaz-limfatyczny' },
    { pattern: /(?:antycell|anticell|антицелл)/i, slug: 'masaz-antycellulitowy' },
    { pattern: /(?:autorsk|signature|авторск)/i, slug: 'masaz-autorski' },
    { pattern: /(?:dwojga|couples|парн|двоих)/i, slug: 'masaz-dla-dwojga' },
  ];
  const alias = aliases.find((item) => item.pattern.test(normalizedName));
  return alias
    ? SITE_SERVICE_PRICE_FALLBACKS.find((item) => item.slug === alias.slug) ?? null
    : null;
};

const isServiceAssignedToEmployee = (service, employee) => {
  if (!service || !employee) return false;
  const assignedIds = Array.isArray(service.payload?.assignedEmployeeIds)
    ? service.payload.assignedEmployeeIds.map((id) => String(id))
    : Array.isArray(service.assignedEmployeeIds)
      ? service.assignedEmployeeIds.map((id) => String(id))
      : [];
  const assignedNames = Array.isArray(service.payload?.assignedEmployeeNames)
    ? service.payload.assignedEmployeeNames.map(normalizeText)
    : Array.isArray(service.assignedEmployeeNames)
      ? service.assignedEmployeeNames.map(normalizeText)
      : [];
  if (assignedIds.length === 0 && assignedNames.length === 0) {
    return true;
  }
  return (
    assignedIds.includes(String(employee.id)) ||
    assignedNames.includes(normalizeText(employee.name))
  );
};

const findPreferredService = ({ employee, requireAssigned = false, serviceId, serviceName, serviceSlug, services = [] }) => {
  const availableServices = requireAssigned
    ? services.filter((service) => isServiceAssignedToEmployee(service, employee))
    : services;
  if (serviceId !== undefined && serviceId !== null && cleanString(serviceId)) {
    const byId = availableServices.find((service) => String(service.id) === String(serviceId));
    if (byId) return byId;
  }

  const normName = normalizeText(serviceName);
  const cleanName = cleanServiceTitle(serviceName);
  const catalogService = getCatalogService({ serviceName, serviceSlug });
  const catalogTitle = cleanServiceTitle(catalogService?.title);
  const matchedServices = availableServices.filter((item) => {
    const payloadSlug = cleanString(item.payload?.slug);
    const itemName = normalizeText(item.name);
    const itemTitle = cleanServiceTitle(item.name);
    const itemCatalog = getCatalogService({ serviceName: item.name, serviceSlug: payloadSlug });
    return (
      itemName === normName ||
      (serviceSlug && normalizeText(payloadSlug) === normalizeText(serviceSlug)) ||
      itemTitle === cleanName ||
      (catalogService && itemCatalog?.slug === catalogService.slug) ||
      (catalogTitle && (
        itemTitle === catalogTitle ||
        itemTitle.includes(catalogTitle) ||
        catalogTitle.includes(itemTitle)
      ))
    );
  });
  const isTopMaster = isTopMasterEmployee(employee);

  return (
    matchedServices.find((service) =>
      isTopMaster ? /top/i.test(service.name) : !/top/i.test(service.name),
    ) || matchedServices[0] || null
  );
};

const getServiceBuffers = (service) => {
  const buffers = service?.buffers && typeof service.buffers === 'object' ? service.buffers : service?.payload?.buffers;
  const afterEnabled = buffers?.afterEnabled === true || service?.payload?.siteBookingBufferAfterEnabled === true;
  const afterMinutes = afterEnabled
    ? Math.max(0, Number(buffers?.afterMinutes ?? service?.payload?.siteBookingBufferAfterMinutes) || 0)
    : 0;
  const beforeEnabled = buffers?.beforeEnabled === true || service?.payload?.siteBookingBufferBeforeEnabled === true;
  const beforeMinutes = beforeEnabled
    ? Math.max(0, Number(buffers?.beforeMinutes ?? service?.payload?.siteBookingBufferBeforeMinutes) || 0)
    : 0;
  return { after: afterMinutes, before: beforeMinutes };
};

const getServiceBasePrice = ({ durationMinutes, employee, serviceName, serviceSlug, services = [] }) => {
  const cleanName = cleanServiceTitle(serviceName);
  const isTopMaster = isTopMasterEmployee(employee);
  const preferredService = findPreferredService({ employee, requireAssigned: true, serviceName, serviceSlug, services });

  if (preferredService) {
    const variant = preferredService.variants?.find((item) => Number(item?.duration) === Number(durationMinutes));
    const crmPrice = Math.max(0, Math.round(Number(variant?.price ?? preferredService.price ?? 0) || 0));
    if (crmPrice > 0) return crmPrice;
  }

  const fallback = SITE_SERVICE_PRICE_FALLBACKS.find(
    (item) =>
      normalizeText(item.slug) === normalizeText(serviceSlug) ||
      cleanServiceTitle(item.title) === cleanName,
  );
  if (!fallback) return 0;

  const durationIndex = fallback.time.findIndex((minutes) => Number(minutes) === Number(durationMinutes));
  const priceIndex = durationIndex >= 0 ? durationIndex : 0;
  const priceList = isTopMaster && fallback.priceTopMaster ? fallback.priceTopMaster : fallback.price;
  return Math.max(0, Math.round(Number(priceList[priceIndex]) || 0));
};

const rangesOverlap = (firstStart, firstEnd, secondStart, secondEnd) =>
  firstStart < secondEnd && secondStart < firstEnd;

const getPremiumPercent = (employee, { date, durationMinutes = 0, time }) => {
  if (!employee?.premiumHoursEnabled || !isInputDate(date)) return 0;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const start = toMinutes(time);
  const duration = Math.max(1, Math.round(Number(durationMinutes) || 0));
  const end = start + duration;

  return (employee.premiumHoursRules ?? []).reduce((maxPercent, rule) => {
    if (rule?.enabled === false) return maxPercent;
    const days = Array.isArray(rule?.daysOfWeek) ? rule.daysOfWeek.map(Number) : [];
    if (!days.includes(weekday)) return maxPercent;
    const ruleStart = toMinutes(rule?.startTime ?? '00:00');
    const rawRuleEnd = toMinutes(rule?.endTime ?? '23:59');
    const ruleEnd = rawRuleEnd <= ruleStart ? rawRuleEnd + 24 * 60 : rawRuleEnd;
    const visitStart = rawRuleEnd <= ruleStart && start < ruleStart ? start + 24 * 60 : start;
    const visitEnd = rawRuleEnd <= ruleStart && end <= ruleStart ? end + 24 * 60 : end;
    if (
      !rangesOverlap(visitStart, visitEnd, ruleStart, ruleEnd) &&
      !rangesOverlap(visitStart + 24 * 60, visitEnd + 24 * 60, ruleStart, ruleEnd)
    ) {
      return maxPercent;
    }
    return Math.max(maxPercent, Number(rule?.percent) || 0);
  }, 0);
};

const calculatePrice = ({ basePrice, date, durationMinutes = 0, employee, time }) => {
  const premiumPercent = getPremiumPercent(employee, { date, durationMinutes, time });
  const premiumAmount = Math.round(basePrice * (premiumPercent / 100));
  const subtotal = basePrice + premiumAmount;
  const discountPercent = Math.max(0, Math.min(100, Number(employee?.siteDiscountPercent) || 0));
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  return {
    basePrice,
    discountAmount,
    discountPercent,
    finalPrice: Math.max(0, subtotal - discountAmount),
    premiumAmount,
    premiumPercent,
    subtotal,
  };
};

const conflictsWithBuffers = (start, end, requestBuffers, interval) => (
  start < interval.end + Math.max(interval.after || 0, requestBuffers.before || 0) &&
  end + Math.max(requestBuffers.after || 0, interval.before || 0) > interval.start
);

const getCalendarIntervals = (rows, date, master, employees = [], services = []) =>
  rows
    .filter((row) => cleanString(row.date) === date)
    .filter((row) => !['cancelled', 'no_show'].includes(cleanString(row.status)))
    .filter((row) => {
      if (!master) return true;
      const rowMaster = cleanString(readPayload(row).master ?? row.master);
      return (
        resolveMaster(rowMaster, employees) === master ||
        normalizeText(rowMaster) === normalizeText(master)
      );
    })
    .map((row) => {
      const payload = readPayload(row);
      const start = toMinutes(row.time ?? payload.time);
      const duration = Math.max(15, Number(payload.duration) || 60);
      const employee = employees.find(
        (item) => resolveMaster(item.name, employees) === resolveMaster(master, employees),
      );
      const buffers = getServiceBuffers(findPreferredService({
        employee,
        serviceId: payload.serviceId,
        serviceName: payload.service,
        services,
      }));
      return { ...buffers, start, end: start + duration };
    });

const getPendingIntervals = (rows, date, master, employees = [], services = []) =>
  rows
    .filter((row) => cleanString(row.preferred_date) === date)
    .filter((row) => cleanString(row.status || 'pending') === 'pending')
    .filter((row) => {
      if (!master) return true;
      const pendingMaster = cleanString(row.preferred_master);
      return (
        resolveMaster(pendingMaster, employees) === master ||
        normalizeText(pendingMaster) === normalizeText(master)
      );
    })
    .map((row) => {
      const start = toMinutes(row.preferred_time);
      const employee = employees.find(
        (item) => resolveMaster(item.name, employees) === resolveMaster(master, employees),
      );
      const buffers = getServiceBuffers(findPreferredService({
        employee,
        serviceName: row.service_name,
        serviceSlug: row.service_slug,
        services,
      }));
      return {
        ...buffers,
        start,
        end: start + Math.max(15, Number(row.duration_minutes) || 60),
      };
    });

const getServicesByMaster = (employees, services) => {
  const result = {};
  employees.forEach((employee) => {
    const rawName = cleanString(employee.name);
    const resolvedName = resolveMaster(rawName, employees) || rawName;
    const slugs = [...new Set(
      services
        .filter((service) => isServiceAssignedToEmployee(service, employee))
        .map((service) => getCatalogService({
          serviceName: service.name,
          serviceSlug: service.payload?.slug,
        })?.slug)
        .filter(Boolean),
    )];
    if (rawName) result[rawName] = slugs;
    if (resolvedName) result[resolvedName] = slugs;
    const alias = SITE_MASTER_ALIASES[normalizeText(rawName)];
    if (alias) result[alias] = slugs;
  });
  return result;
};

const buildSlots = async ({ durationMinutes, preferredDate, preferredMaster, serviceName, serviceSlug }) => {
  if (!isInputDate(preferredDate)) throw validationError('preferredDate is invalid');

  const duration = Math.max(15, Number(durationMinutes) || 60);
  const [employeeRows, serviceRows, calendarRows, bookingRows] = await Promise.all([
    prisma.employee.findMany(),
    prisma.service.findMany(),
    prisma.calendarEntry.findMany({ where: { date: preferredDate } }),
    prisma.$queryRaw`
      select preferred_date, preferred_time, preferred_master, duration_minutes, service_name, service_slug, status
      from site_booking_requests
      where preferred_date = ${preferredDate} and status = 'pending'
    `,
  ]);

  const activeEmployees = employeeRows
    .map(toPublicEmployee)
    .filter((employee) => employee.siteVisible && employee.status !== 'Архив' && employee.status !== 'Удален');

  const availableMasters = [...new Set(activeEmployees.map((e) => cleanString(e.name)).filter(Boolean))];

  let employees = activeEmployees.filter((employee) => isEmployeeAvailableOnDate(employee, preferredDate));
  if (!employees.length) {
    employees = employeeRows.length
      ? []
      : DEFAULT_MASTERS.map((name) => ({
          name,
          shiftStart: DEFAULT_WORKDAY_START,
          shiftEnd: DEFAULT_WORKDAY_END,
          workingDaysOfWeek: [1, 2, 3, 4, 5, 6, 0],
        }));
  }

  if (preferredMaster) {
    const resolved = resolveMaster(preferredMaster, employees);
    employees = employees.filter((employee) => resolveMaster(employee.name, employees) === resolved);
  }

  const services = serviceRows.map(toPublicService).filter((service) => service.siteVisible && service.status !== 'Архив');
  const warsawNow = getWarsawNow();

  const slots = employees.flatMap((employee) => {
    const master = cleanString(employee.name);
    const preferredService = findPreferredService({
      employee,
      requireAssigned: true,
      serviceName,
      serviceSlug,
      services,
    });
    if (!preferredService) return [];
    const requestedVariant = preferredService.variants?.find(
      (item) => Number(item?.duration) === Number(duration),
    );
    if (!requestedVariant && Number(preferredService.price) <= 0) return [];
    const basePrice = getServiceBasePrice({ durationMinutes: duration, employee, serviceName, serviceSlug, services });
    if (basePrice <= 0) return [];
    const requestBuffers = getServiceBuffers(preferredService);
    const shift = getEmployeeShiftForDate(employee, preferredDate);
    const start = toMinutes(shift.start);
    const end = toMinutes(shift.end);
    const busy = [
      ...getCalendarIntervals(calendarRows, preferredDate, master, employees, services),
      ...getPendingIntervals(bookingRows, preferredDate, master, employees, services),
    ];
    const employeeSlots = [];

    for (let minutes = start; minutes + duration <= end; minutes += DEFAULT_SLOT_STEP) {
      if (preferredDate === warsawNow.date && minutes <= warsawNow.minutes + 60) continue;
      if (busy.some((interval) => conflictsWithBuffers(minutes, minutes + duration, requestBuffers, interval))) continue;
      const startTime = toClockTime(minutes);
      employeeSlots.push({
        employeeId: employee.id || null,
        master,
        startTime,
        ...calculatePrice({ basePrice, date: preferredDate, durationMinutes: duration, employee, time: startTime }),
      });
    }

    return employeeSlots;
  });

  return { slots, masters: availableMasters.length ? availableMasters : DEFAULT_MASTERS };
};

const notifyOwnerAboutBooking = async (booking) => {
  const settings = await prisma.systemState
    .findUnique({where: {key: 'appSettings'}})
    .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
    .catch(() => ({}));

  if (settings.telegramEnabled !== true || settings.siteBookingNotifyTelegramEnabled !== true) {
    return {
      error: 'telegram disabled in settings',
      reason: 'telegram_disabled',
      skipped: true,
      success: false,
    };
  }

  const chatId = firstNonEmpty(
    settings.telegramChatId,
    process.env.TELEGRAM_CHAT_ID,
    process.env.TELEGRAM_OWNER_CHAT_ID,
  );
  if (!chatId) {
    return {
      error: 'telegramChatId is required',
      reason: 'telegram_chat_missing',
      skipped: true,
      success: false,
    };
  }

  const lines = [
    'Nowa rezerwacja NUAR',
    `${booking.clientName} · ${booking.clientPhone}`,
    booking.clientEmail ? booking.clientEmail : null,
    `${booking.preferredDate} ${booking.preferredTime}`,
    `${booking.serviceName} · ${booking.durationMinutes} min`,
    booking.preferredMaster ? `Master: ${booking.preferredMaster}` : null,
    booking.note ? `Uwagi: ${booking.note}` : null,
  ].filter(Boolean);

  const result = await telegramDigest({
    chatId,
    notificationEventId: booking.notificationEventId,
    purpose: 'site-booking',
    text: lines.join('\n'),
  }).catch((error) => {
    console.error('Site booking owner notification failed:', error);
    return {success: false, error: error?.message || 'Telegram request failed'};
  });

  if (!result?.success && !result?.skipped) {
    await recordErrorEvent(prisma, {
      context: {
        bookingId: booking.id,
        chatIdPresent: Boolean(chatId),
        telegramError: result?.error ?? '',
      },
      error: new Error(result?.error || 'Telegram site booking notification failed'),
      message: 'Telegram site booking notification failed',
      source: 'site-booking',
    }).catch(() => {});
  }

  return result;
};

const createSiteBookingWaitlistEntry = (tx, booking, client) => {
  const contactLines = [
    `Телефон: ${booking.clientPhone}`,
    booking.clientEmail ? `Email: ${booking.clientEmail}` : null,
    booking.note ? `Комментарий: ${booking.note}` : null,
    `Заявка сайта: ${booking.id}`,
  ].filter(Boolean);

  return tx.waitlistEntry.create({
    data: {
      clientId: client.id,
      clientName: booking.clientName,
      note: contactLines.join('\n'),
      payload: {
        basePrice: booking.basePrice,
        bookedPrice: booking.finalPrice,
        clientEmail: booking.clientEmail || null,
        clientPhone: booking.clientPhone,
        discountAmount: booking.discountAmount,
        discountPercent: booking.discountPercent,
        durationMinutes: booking.durationMinutes,
        premiumAmount: booking.premiumAmount,
        premiumPercent: booking.premiumPercent,
        source: 'site-booking',
        siteBookingRequestId: booking.id,
      },
      preferredDate: booking.preferredDate,
      preferredMaster: booking.preferredMaster || null,
      preferredService: booking.serviceName,
      preferredTimeFrom: booking.preferredTime,
      preferredTimeTo: addMinutesToTime(booking.preferredTime, booking.durationMinutes),
      status: 'active',
    },
  });
};

const createSiteBookingNotification = (tx, booking, waitlistEntry, client) =>
  upsertNotificationEvent(tx, {
    clientId: client.id,
    clientName: booking.clientName,
    entityId: booking.id,
    entityType: 'site_booking_request',
    fingerprint: `site-booking:${booking.id}`,
    payload: {
      bookedPrice: booking.finalPrice,
      durationMinutes: booking.durationMinutes,
      preferredDate: booking.preferredDate,
      preferredMaster: booking.preferredMaster,
      preferredMasterId: booking.preferredMasterId || null,
      preferredTime: booking.preferredTime,
      serviceName: booking.serviceName,
      waitlistEntryId: waitlistEntry?.id ?? null,
    },
    priority: 'high',
    recommendedAction: 'open',
    score: 80,
    source: 'site-booking',
    title: 'Новая заявка с сайта',
    message: `${booking.clientName} · ${booking.serviceName} · ${booking.preferredDate} ${booking.preferredTime}`,
    type: 'site_booking_request',
  });

publicSiteBookingRouter.get('/site-booking-masters', async (req, res) => {
  try {
    await ensureSiteBookingTables(prisma);
    const [rows, serviceRows] = await Promise.all([
      prisma.employee.findMany(),
      prisma.service.findMany(),
    ]);
    const active = rows
      .map(toPublicEmployee)
      .filter((employee) => employee.siteVisible && employee.status !== 'Архив' && employee.status !== 'Удален');
    const services = serviceRows
      .map(toPublicService)
      .filter((service) => service.siteVisible && service.status !== 'Архив');
    const masters = [...new Set(active.map((e) => cleanString(e.name)).filter(Boolean))];
    res.json({
      success: true,
      data: {
        masters: masters.length ? masters : DEFAULT_MASTERS,
        servicesByMaster: getServicesByMaster(active, services),
      },
    });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

publicSiteBookingRouter.post('/site-booking-availability', async (req, res) => {
  try {
    await ensureSiteBookingTables(prisma);
    const { slots, masters } = await buildSlots({
      durationMinutes: req.body?.durationMinutes,
      preferredDate: cleanString(req.body?.preferredDate),
      preferredMaster: cleanString(req.body?.preferredMaster),
      serviceName: cleanString(req.body?.serviceName),
      serviceSlug: cleanString(req.body?.serviceSlug),
    });
    res.json({ success: true, data: { slots, masters } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

publicSiteBookingRouter.post('/site-booking-submit', publicBookingLimiter, async (req, res) => {
  const clientName = cleanString(req.body?.clientName);
  const clientPhone = normalizePhone(req.body?.clientPhone);
  const serviceName = cleanString(req.body?.serviceName);
  const preferredDate = cleanString(req.body?.preferredDate);
  const preferredTime = cleanString(req.body?.preferredTime).slice(0, 5);
  const durationMinutes = Math.max(15, Number(req.body?.durationMinutes) || 60);

  try {
    if (clientName.length < 2) throw validationError('clientName is required');
    if (!clientPhone) throw validationError('clientPhone is required');
    if (!serviceName) throw validationError('serviceName is required');
    if (!isInputDate(preferredDate)) throw validationError('preferredDate is invalid');
    if (!/^\d{2}:\d{2}$/.test(preferredTime)) throw validationError('preferredTime is invalid');

    await ensureSiteBookingTables(prisma);
    const { slots: currentSlots } = await buildSlots({
      durationMinutes,
      preferredDate,
      preferredMaster: cleanString(req.body?.preferredMaster),
      serviceName,
      serviceSlug: cleanString(req.body?.serviceSlug),
    });
    const requestedSlot = currentSlots.find(
      (slot) =>
        cleanString(slot.startTime) === preferredTime &&
        (!cleanString(req.body?.preferredMaster) ||
          resolveMaster(slot.master) === resolveMaster(req.body?.preferredMaster)),
    );
    if (!requestedSlot) throw validationError('preferredTime is unavailable');

    const id = crypto.randomUUID();
    const booking = {
      basePrice: Number(requestedSlot.basePrice) || 0,
      clientEmail: cleanString(req.body?.clientEmail),
      clientName,
      clientPhone,
      discountAmount: Number(requestedSlot.discountAmount) || 0,
      discountPercent: Number(requestedSlot.discountPercent) || 0,
      durationMinutes,
      finalPrice: Number(requestedSlot.finalPrice) || 0,
      id,
      note: cleanString(req.body?.note),
      premiumAmount: Number(requestedSlot.premiumAmount) || 0,
      premiumPercent: Number(requestedSlot.premiumPercent) || 0,
      preferredDate,
      preferredMaster: cleanString(requestedSlot.master),
      preferredMasterId: Number(requestedSlot.employeeId) || null,
      preferredTime,
      serviceName,
      serviceSlug: cleanString(req.body?.serviceSlug),
    };
    let businessEvent = null;
    let crmLinks = {};
    const rows = await prisma.$transaction(async (tx) => {
      const insertedRows = await tx.$queryRaw`
        insert into site_booking_requests (
          id, client_name, client_phone, client_email, service_slug, service_name,
          preferred_date, preferred_time, preferred_master, duration_minutes,
          status, note, locale, payload, created_at, updated_at
        )
        values (
          ${id}, ${clientName}, ${clientPhone}, ${booking.clientEmail || null},
          ${booking.serviceSlug || null}, ${serviceName}, ${preferredDate},
          ${preferredTime}, ${booking.preferredMaster || null}, ${durationMinutes},
          'pending', ${booking.note || null}, ${cleanString(req.body?.locale) || null},
          ${JSON.stringify({
            ...req.body,
            basePrice: booking.basePrice,
            discountAmount: booking.discountAmount,
            discountPercent: booking.discountPercent,
            finalPrice: booking.finalPrice,
            premiumAmount: booking.premiumAmount,
            premiumPercent: booking.premiumPercent,
            source: 'site-booking',
          })}::jsonb, now(), now()
        )
        returning id
      `;
      const client = await findOrCreateSiteBookingClient(tx, booking);
      const waitlistEntry = await createSiteBookingWaitlistEntry(tx, booking, client);
      const notificationEvent = await createSiteBookingNotification(tx, booking, waitlistEntry, client);
      businessEvent = notificationEvent;
      crmLinks = {
        notificationEventId: notificationEvent?.id ?? null,
        clientId: client.id,
        waitlistEntryId: waitlistEntry.id,
      };

      await tx.$executeRaw`
        update site_booking_requests
        set payload = coalesce(payload, '{}'::jsonb) || ${JSON.stringify(crmLinks)}::jsonb,
            updated_at = now()
        where id = ${id}
      `;

      return insertedRows;
    });

    if (businessEvent) {
      await queueBusinessPushDeliveries(prisma, businessEvent).catch((error) => {
        console.error('Site booking Web Push queue failed:', error);
      });
    }

    const notifyResult = await notifyOwnerAboutBooking({
      ...booking,
      notificationEventId: crmLinks.notificationEventId,
    });

    res.json({
      success: true,
      data: {
        id: rows?.[0]?.id ?? id,
        clientId: crmLinks.clientId ?? null,
        waitlistEntryId: crmLinks.waitlistEntryId ?? null,
        notification: notifyResult
          ? {
              error: notifyResult.error ?? '',
              skipped: notifyResult.skipped === true,
              success: notifyResult.success === true,
            }
          : null,
      },
    });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

siteBookingRouter.get('/site-bookings', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const status = cleanString(req.query.status);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  try {
    await ensureSiteBookingTables(prisma);
    const rows = status
      ? await prisma.$queryRawUnsafe(
          `select ${SELECT_SITE_BOOKING} from site_booking_requests where status = $1 order by created_at desc limit $2`,
          status,
          limit,
        )
      : await prisma.$queryRawUnsafe(
          `select ${SELECT_SITE_BOOKING} from site_booking_requests order by created_at desc limit $1`,
          limit,
        );
    res.json({ success: true, data: rows ?? [] });
  } catch (error) {
    await handleRouteError(req, res, error, { status, limit });
  }
});

siteBookingRouter.patch('/site-bookings/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const id = cleanString(req.params.id);
  const status = cleanString(req.body?.status);
  const linkedCalendarEntryId = cleanString(req.body?.linked_calendar_entry_id);

  try {
    if (!id) throw validationError('id is required');
    if (status && !['pending', 'applied', 'rejected'].includes(status)) {
      throw validationError('status is invalid');
    }

    await ensureSiteBookingTables(prisma);
    const beforeRows = await prisma.$queryRaw`
      select id, client_name, client_phone, client_email, service_slug, service_name,
             preferred_date, preferred_time, preferred_master, duration_minutes, status,
             note, linked_calendar_entry_id, created_at, updated_at
      from site_booking_requests
      where id = ${id}
      limit 1
    `;
    const rows = await prisma.$queryRawUnsafe(
      `update site_booking_requests
       set status = coalesce($2, status),
           linked_calendar_entry_id = coalesce($3, linked_calendar_entry_id),
           updated_at = now()
       where id = $1
       returning ${SELECT_SITE_BOOKING}`,
      id,
      status || null,
      linkedCalendarEntryId || null,
    );

    const row = rows?.[0] ?? null;
    if (!row) throw validationError('Site booking request not found');

    await recordAuditLog(prisma, req, {
      action: 'update site booking request',
      after: row,
      before: beforeRows?.[0] ?? null,
      entity: 'SiteBookingRequest',
      entityId: id,
    });

    if (['applied', 'rejected'].includes(row.status)) {
      await prisma.waitlistEntry
        .updateMany({
          data: {status: 'closed'},
          where: {
            payload: {
              path: ['siteBookingRequestId'],
              equals: id,
            },
          },
        })
        .catch((error) => {
          console.error('Failed to close site booking waitlist entry:', error);
        });
    }

    res.json({ success: true, data: row });
  } catch (error) {
    await handleRouteError(req, res, error, { id });
  }
});

module.exports = {
  publicSiteBookingRouter,
  siteBookingRouter,
};
