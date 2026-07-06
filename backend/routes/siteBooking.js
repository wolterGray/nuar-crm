const crypto = require('crypto');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
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

const isInputDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));

const normalizePhone = (value) => String(value ?? '').replace(/[^\d+]/g, '');

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
    premiumHoursEnabled: payload.premiumHoursEnabled === true,
    premiumHoursRules: Array.isArray(payload.premiumHoursRules) ? payload.premiumHoursRules : [],
    shiftEnd: cleanString(row?.shiftEnd ?? payload.shiftEnd) || DEFAULT_WORKDAY_END,
    shiftStart: cleanString(row?.shiftStart ?? payload.shiftStart) || DEFAULT_WORKDAY_START,
    siteDiscountPercent: Number(payload.siteDiscountPercent) || 0,
    siteVisible: row?.siteVisible !== false && payload.siteBookingEnabled !== false,
    status: cleanString(row?.status ?? payload.status),
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
  return Math.max(0, Math.round(Number(variant?.price ?? service?.price ?? 0) || 0));
};

const getPremiumPercent = (employee, { date, time }) => {
  if (!employee?.premiumHoursEnabled || !isInputDate(date)) return 0;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const value = toMinutes(time);

  return (employee.premiumHoursRules ?? []).reduce((maxPercent, rule) => {
    if (rule?.enabled === false) return maxPercent;
    const days = Array.isArray(rule?.daysOfWeek) ? rule.daysOfWeek.map(Number) : [];
    if (!days.includes(weekday)) return maxPercent;
    if (value < toMinutes(rule?.startTime ?? '00:00') || value >= toMinutes(rule?.endTime ?? '23:59')) {
      return maxPercent;
    }
    return Math.max(maxPercent, Number(rule?.percent) || 0);
  }, 0);
};

const calculatePrice = ({ basePrice, date, employee, time }) => {
  const premiumPercent = getPremiumPercent(employee, { date, time });
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

  let employees = employeeRows.map(toPublicEmployee).filter((employee) => employee.siteVisible && employee.status !== 'Архив');
  if (!employees.length) {
    employees = DEFAULT_MASTERS.map((name) => ({ name, shiftStart: DEFAULT_WORKDAY_START, shiftEnd: DEFAULT_WORKDAY_END }));
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
    const start = toMinutes(employee.shiftStart || DEFAULT_WORKDAY_START);
    const end = toMinutes(employee.shiftEnd || DEFAULT_WORKDAY_END);
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
        ...calculatePrice({ basePrice, date: preferredDate, employee, time: startTime }),
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

  if (settings.siteBookingNotifyTelegramEnabled === false) return;

  const chatId = cleanString(settings.telegramChatId ?? process.env.TELEGRAM_CHAT_ID);
  if (!chatId) return;

  const lines = [
    'Nowa rezerwacja NUAR',
    `${booking.clientName} · ${booking.clientPhone}`,
    booking.clientEmail ? booking.clientEmail : null,
    `${booking.preferredDate} ${booking.preferredTime}`,
    `${booking.serviceName} · ${booking.durationMinutes} min`,
    booking.preferredMaster ? `Master: ${booking.preferredMaster}` : null,
    booking.note ? `Uwagi: ${booking.note}` : null,
  ].filter(Boolean);

  await telegramDigest({
    chatId,
    text: lines.join('\n'),
  }).catch((error) => {
    console.error('Site booking owner notification failed:', error);
  });
};

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
    const id = crypto.randomUUID();
    const rows = await prisma.$queryRaw`
      insert into site_booking_requests (
        id, client_name, client_phone, client_email, service_slug, service_name,
        preferred_date, preferred_time, preferred_master, duration_minutes,
        status, note, locale, payload, created_at, updated_at
      )
      values (
        ${id}, ${clientName}, ${clientPhone}, ${cleanString(req.body?.clientEmail) || null},
        ${cleanString(req.body?.serviceSlug) || null}, ${serviceName}, ${preferredDate},
        ${preferredTime}, ${cleanString(req.body?.preferredMaster) || null}, ${durationMinutes},
        'pending', ${cleanString(req.body?.note) || null}, ${cleanString(req.body?.locale) || null},
        ${JSON.stringify(req.body ?? {})}::jsonb, now(), now()
      )
      returning id
    `;

    await notifyOwnerAboutBooking({
      clientEmail: cleanString(req.body?.clientEmail),
      clientName,
      clientPhone,
      durationMinutes,
      note: cleanString(req.body?.note),
      preferredDate,
      preferredMaster: cleanString(req.body?.preferredMaster),
      preferredTime,
      serviceName,
    });

    res.json({ success: true, data: { id: rows?.[0]?.id ?? id } });
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

    res.json({ success: true, data: row });
  } catch (error) {
    await handleRouteError(req, res, error, { id });
  }
});

module.exports = {
  publicSiteBookingRouter,
  siteBookingRouter,
};
