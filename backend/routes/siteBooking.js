const crypto = require('crypto');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
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
  { slug: 'masaz-klasyczny', title: 'Masaż klasyczny', time: [30, 60, 75, 90, 120], price: [170, 255, 310, 360, 450] },
  { slug: 'masaz-sportowy', title: 'Masaż sportowy', time: [30, 60, 75, 90, 120], price: [170, 255, 310, 360, 450] },
  { slug: 'masaz-relaksacyjny', title: 'Masaż relaksacyjny', time: [30, 60, 75, 90, 120], price: [170, 255, 310, 360, 450] },
  { slug: 'masaz-limfatyczny', title: 'Masaż limfatyczny', time: [30, 60, 75, 90, 120], price: [170, 255, 310, 360, 450] },
  { slug: 'masaz-antycellulitowy', title: 'Masaż antycellulitowy', time: [30, 60, 75, 90, 120], price: [170, 255, 310, 360, 450] },
  { slug: 'masaz-twarzy-i-glowy', title: 'Masaż twarzy i głowy', time: [30, 60], price: [149, 220] },
  { slug: 'masaz-autorski', title: 'Masaż autorski', time: [90, 120], price: [490, 590] },
  { slug: 'masaz-dla-dzieci', title: 'Masaż dla dzieci', time: [30, 60, 75, 90, 120], price: [170, 250, 310, 360, 450] },
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

const addMinutesToTime = (time, minutesToAdd) => {
  const total = Math.min(24 * 60 - 1, Math.max(0, toMinutes(time) + Math.max(1, Number(minutesToAdd) || 0)));
  return toClockTime(total);
};

const normalizeWorkingDays = (value) => {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5, 6, 0];
  const days = [...new Set(value.map(Number).filter((day) => day >= 0 && day <= 6))];
  return days.length ? days : [1, 2, 3, 4, 5, 6, 0];
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
  if (!raw) return cleanString(employees[0]?.name) || DEFAULT_MASTERS[0];

  const alias = SITE_MASTER_ALIASES[normalizeText(raw)];
  if (alias) return alias;

  const matched = employees.find((employee) => normalizeText(employee.name) === normalizeText(raw));
  return SITE_MASTER_ALIASES[normalizeText(matched?.name)] || cleanString(matched?.name) || raw;
};

const readPayload = (row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {});

const toPublicEmployee = (row) => {
  const payload = readPayload(row);
  const name = cleanString(row?.name ?? payload.name);
  return {
    name,
    bookingBlockedDates: normalizeBlockedDates(payload.bookingBlockedDates),
    premiumHoursEnabled: payload.premiumHoursEnabled === true,
    premiumHoursRules: Array.isArray(payload.premiumHoursRules) ? payload.premiumHoursRules : [],
    dailyShifts: normalizeDailyShifts(payload.dailyShifts ?? row?.shifts),
    shiftEnd: cleanString(row?.shiftEnd ?? payload.shiftEnd) || DEFAULT_WORKDAY_END,
    shiftStart: cleanString(row?.shiftStart ?? payload.shiftStart) || DEFAULT_WORKDAY_START,
    siteDiscountPercent: Number(payload.siteDiscountPercent) || 0,
    siteVisible: row?.siteVisible !== false && payload.siteBookingEnabled !== false,
    status: cleanString(row?.status ?? payload.status),
    workingDaysOfWeek: normalizeWorkingDays(payload.workingDaysOfWeek),
  };
};

const toPublicService = (row) => {
  const payload = readPayload(row);
  return {
    name: cleanString(row?.name ?? payload.name),
    buffers: row?.buffers && typeof row.buffers === 'object' ? row.buffers : {},
    payload,
    price: Number(row?.price) || 0,
    siteVisible: row?.siteVisible !== false && payload.siteBookingEnabled !== false,
    status: cleanString(row?.status ?? payload.status),
    variants: Array.isArray(row?.variants) ? row.variants : Array.isArray(payload.variants) ? payload.variants : [],
  };
};

const getServiceBasePrice = ({ durationMinutes, serviceName, serviceSlug, services }) => {
  const service = services.find((item) => {
    const payloadSlug = cleanString(item.payload?.slug);
    return (
      normalizeText(item.name) === normalizeText(serviceName) ||
      (serviceSlug && normalizeText(payloadSlug) === normalizeText(serviceSlug))
    );
  });

  const variant = service?.variants?.find((item) => Number(item?.duration) === Number(durationMinutes));
  const crmPrice = Math.max(0, Math.round(Number(variant?.price ?? service?.price ?? 0) || 0));
  if (crmPrice > 0) return crmPrice;

  const fallback = SITE_SERVICE_PRICE_FALLBACKS.find(
    (item) =>
      normalizeText(item.slug) === normalizeText(serviceSlug) ||
      normalizeText(item.title) === normalizeText(serviceName),
  );
  if (!fallback) return 0;

  const durationIndex = fallback.time.findIndex((minutes) => Number(minutes) === Number(durationMinutes));
  const priceIndex = durationIndex >= 0 ? durationIndex : 0;
  return Math.max(0, Math.round(Number(fallback.price[priceIndex]) || 0));
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

const overlaps = (start, end, interval) => start < interval.end && end > interval.start;

const getCalendarIntervals = (rows, date, master) =>
  rows
    .filter((row) => cleanString(row.date) === date)
    .filter((row) => !['cancelled', 'no_show'].includes(cleanString(row.status)))
    .filter((row) => !master || resolveMaster(readPayload(row).master ?? row.master) === master)
    .map((row) => {
      const payload = readPayload(row);
      const start = toMinutes(row.time ?? payload.time);
      const duration = Math.max(15, Number(payload.duration) || 60);
      return { start, end: start + duration };
    });

const getPendingIntervals = (rows, date, master) =>
  rows
    .filter((row) => cleanString(row.preferred_date) === date)
    .filter((row) => cleanString(row.status || 'pending') === 'pending')
    .filter((row) => !master || resolveMaster(row.preferred_master) === master)
    .map((row) => {
      const start = toMinutes(row.preferred_time);
      return { start, end: start + Math.max(15, Number(row.duration_minutes) || 60) };
    });

const buildSlots = async ({ durationMinutes, preferredDate, preferredMaster, serviceName, serviceSlug }) => {
  if (!isInputDate(preferredDate)) throw validationError('preferredDate is invalid');

  const duration = Math.max(15, Number(durationMinutes) || 60);
  const [employeeRows, serviceRows, calendarRows, bookingRows] = await Promise.all([
    prisma.employee.findMany(),
    prisma.service.findMany(),
    prisma.calendarEntry.findMany({ where: { date: preferredDate } }),
    prisma.$queryRaw`
      select preferred_date, preferred_time, preferred_master, duration_minutes, status
      from site_booking_requests
      where preferred_date = ${preferredDate} and status = 'pending'
    `,
  ]);

  let employees = employeeRows
    .map(toPublicEmployee)
    .filter((employee) => employee.siteVisible && employee.status !== 'Архив')
    .filter((employee) => isEmployeeAvailableOnDate(employee, preferredDate));
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
  const basePrice = getServiceBasePrice({ durationMinutes: duration, serviceName, serviceSlug, services });
  const today = new Date().toISOString().slice(0, 10);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  return employees.flatMap((employee) => {
    const master = resolveMaster(employee.name, employees);
    const shift = getEmployeeShiftForDate(employee, preferredDate);
    const start = toMinutes(shift.start);
    const end = toMinutes(shift.end);
    const busy = [
      ...getCalendarIntervals(calendarRows, preferredDate, master),
      ...getPendingIntervals(bookingRows, preferredDate, master),
    ];
    const slots = [];

    for (let minutes = start; minutes + duration <= end; minutes += DEFAULT_SLOT_STEP) {
      if (preferredDate === today && minutes <= nowMinutes + 60) continue;
      if (busy.some((interval) => overlaps(minutes, minutes + duration, interval))) continue;
      const startTime = toClockTime(minutes);
      slots.push({
        master,
        startTime,
        ...calculatePrice({ basePrice, date: preferredDate, durationMinutes: duration, employee, time: startTime }),
      });
    }

    return slots;
  });
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

const createSiteBookingWaitlistEntry = (tx, booking) => {
  const contactLines = [
    `Телефон: ${booking.clientPhone}`,
    booking.clientEmail ? `Email: ${booking.clientEmail}` : null,
    booking.note ? `Комментарий: ${booking.note}` : null,
    `Заявка сайта: ${booking.id}`,
  ].filter(Boolean);

  return tx.waitlistEntry.create({
    data: {
      clientId: null,
      clientName: booking.clientName,
      note: contactLines.join('\n'),
      payload: {
        clientEmail: booking.clientEmail || null,
        clientPhone: booking.clientPhone,
        durationMinutes: booking.durationMinutes,
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

const createSiteBookingNotification = (tx, booking, waitlistEntry) =>
  upsertNotificationEvent(tx, {
    clientId: null,
    clientName: booking.clientName,
    entityId: booking.id,
    entityType: 'site_booking_request',
    fingerprint: `site-booking:${booking.id}`,
    payload: {
      durationMinutes: booking.durationMinutes,
      preferredDate: booking.preferredDate,
      preferredMaster: booking.preferredMaster,
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

publicSiteBookingRouter.post('/site-booking-availability', async (req, res) => {
  try {
    await ensureSiteBookingTables(prisma);
    const slots = await buildSlots({
      durationMinutes: req.body?.durationMinutes,
      preferredDate: cleanString(req.body?.preferredDate),
      preferredMaster: cleanString(req.body?.preferredMaster),
      serviceName: cleanString(req.body?.serviceName),
      serviceSlug: cleanString(req.body?.serviceSlug),
    });
    res.json({ success: true, data: { slots } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

publicSiteBookingRouter.post('/site-booking-submit', async (req, res) => {
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
    const currentSlots = await buildSlots({
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
      clientEmail: cleanString(req.body?.clientEmail),
      clientName,
      clientPhone,
      durationMinutes,
      id,
      note: cleanString(req.body?.note),
      preferredDate,
      preferredMaster: cleanString(req.body?.preferredMaster),
      preferredTime,
      serviceName,
      serviceSlug: cleanString(req.body?.serviceSlug),
    };
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
          ${JSON.stringify({...req.body, source: 'site-booking'})}::jsonb, now(), now()
        )
        returning id
      `;
      const waitlistEntry = await createSiteBookingWaitlistEntry(tx, booking);
      const notificationEvent = await createSiteBookingNotification(tx, booking, waitlistEntry);
      crmLinks = {
        notificationEventId: notificationEvent?.id ?? null,
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

    const notifyResult = await notifyOwnerAboutBooking({
      ...booking,
      notificationEventId: crmLinks.notificationEventId,
    });

    res.json({
      success: true,
      data: {
        id: rows?.[0]?.id ?? id,
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

siteBookingRouter.get('/site-bookings', requireOwner, async (req, res) => {
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

siteBookingRouter.patch('/site-bookings/:id', requireOwner, async (req, res) => {
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
