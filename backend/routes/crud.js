// backend/routes/crud.js
// CRUD routes for CRM data using Prisma.

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ----- Helper for unified response -----
const respond = (res, promise) => {
  promise
    .then((data) => res.json({ success: true, data }))
    .catch((err) => {
      console.error('CRUD error:', err);
      res.status(400).json({ success: false, error: err.message });
    });
};

const clientSelect = {
  id: true,
  name: true,
  messageName: true,
  phone: true,
  email: true,
  birthday: true,
  instagram: true,
  telegram: true,
  source: true,
  messageLanguage: true,
  preference: true,
  status: true,
  tags: true,
  note: true,
  createdAt: true,
  updatedAt: true,
};

const cleanOptionalString = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

const buildClientData = (body) => ({
  name: String(body?.name ?? '').trim(),
  messageName: cleanOptionalString(body?.messageName),
  phone: cleanOptionalString(body?.phone),
  email: cleanOptionalString(body?.email),
  birthday: cleanOptionalString(body?.birthday),
  instagram: cleanOptionalString(body?.instagram),
  telegram: cleanOptionalString(body?.telegram),
  source: cleanOptionalString(body?.source),
  messageLanguage: cleanOptionalString(body?.messageLanguage),
  preference: cleanOptionalString(body?.preference),
  status: cleanOptionalString(body?.status),
  tags: cleanOptionalString(body?.tags),
  note: cleanOptionalString(body?.note),
});

const withStoredId = (record) => ({
  ...(record?.payload && typeof record.payload === 'object' ? record.payload : {}),
  id: record?.id,
});

const buildCalendarEntryData = (payload) => ({
  kind: cleanOptionalString(payload?.kind),
  date: cleanOptionalString(payload?.date),
  time: cleanOptionalString(payload?.time),
  status: cleanOptionalString(payload?.status),
  visitId: payload?.visitId ? Number(payload.visitId) : null,
  payload,
});

const toDateTime = (date, time) => {
  if (!date) return null;

  const value = new Date(`${date}T${time || '00:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const buildVisitData = (payload) => ({
  clientId: null,
  serviceId: null,
  scheduledAt: toDateTime(payload?.inputDate || payload?.date, payload?.time),
  notes: cleanOptionalString(payload?.note),
  calendarEntryId: payload?.calendarEntryId ? Number(payload.calendarEntryId) : null,
  recordType: cleanOptionalString(payload?.recordType),
  payload,
});

const firstServiceVariant = (variants) => {
  if (!Array.isArray(variants)) {
    return null;
  }

  return (
    variants.find(
      (variant) =>
        Number(variant?.duration) > 0 || Number(variant?.price) > 0,
    ) ?? null
  );
};

const buildServiceData = (payload) => {
  const variants = Array.isArray(payload?.variants) ? payload.variants : [];
  const firstVariant = firstServiceVariant(variants);

  return {
    name: String(payload?.name ?? '').trim(),
    category: cleanOptionalString(payload?.category),
    description: cleanOptionalString(payload?.description),
    color: cleanOptionalString(payload?.color),
    variants,
    status: cleanOptionalString(payload?.status),
    bookingSettings: payload?.bookingSettings ?? null,
    buffers: {
      afterEnabled: payload?.siteBookingBufferAfterEnabled === true,
      afterMinutes: Math.max(0, Number(payload?.siteBookingBufferAfterMinutes) || 0),
      beforeEnabled: payload?.siteBookingBufferBeforeEnabled === true,
      beforeMinutes: Math.max(0, Number(payload?.siteBookingBufferBeforeMinutes) || 0),
    },
    siteVisible:
      typeof payload?.siteVisible === 'boolean'
        ? payload.siteVisible
        : typeof payload?.siteBookingEnabled === 'boolean'
          ? payload.siteBookingEnabled
          : null,
    price: firstVariant ? Number(firstVariant.price) || null : null,
    durationMin: firstVariant ? Number(firstVariant.duration) || null : null,
    payload,
  };
};

const buildEmployeeData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  phone: cleanOptionalString(payload?.phone),
  email: cleanOptionalString(payload?.email),
  role: cleanOptionalString(payload?.role),
  status: cleanOptionalString(payload?.status),
  color: cleanOptionalString(payload?.color),
  commissionRate:
    payload?.commissionRate !== undefined && payload?.commissionRate !== null
      ? Number(payload.commissionRate) || 0
      : null,
  shiftStart: cleanOptionalString(payload?.shiftStart),
  shiftEnd: cleanOptionalString(payload?.shiftEnd),
  payrollSchedule: cleanOptionalString(payload?.payrollSchedule),
  siteBookingSlotMinutes:
    payload?.siteBookingSlotMinutes !== undefined && payload?.siteBookingSlotMinutes !== null
      ? Number(payload.siteBookingSlotMinutes) || null
      : null,
  services: payload?.services ?? payload?.serviceIds ?? null,
  siteVisible:
    typeof payload?.siteVisible === 'boolean'
      ? payload.siteVisible
      : typeof payload?.siteBookingEnabled === 'boolean'
        ? payload.siteBookingEnabled
        : null,
  pricing: {
    premiumHoursEnabled: payload?.premiumHoursEnabled === true,
    premiumHoursRules: Array.isArray(payload?.premiumHoursRules)
      ? payload.premiumHoursRules
      : [],
    siteDiscountPercent: Math.max(0, Number(payload?.siteDiscountPercent) || 0),
  },
  payrollSettings: payload?.payrollSettings ?? null,
  shifts: payload?.shifts ?? null,
  payload,
});

// ==================== Visit state used by the CRM UI ====================
router.get('/visit-state', async (req, res) => {
  try {
    const [calendarEntries, visits] = await Promise.all([
      prisma.calendarEntry.findMany({orderBy: [{date: 'asc'}, {time: 'asc'}, {id: 'asc'}]}),
      prisma.visit.findMany({orderBy: {createdAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        calendarEntries: calendarEntries.map(withStoredId),
        visits: visits.map(withStoredId),
      },
    });
  } catch (err) {
    console.error('Visit state error:', err);
    res.status(400).json({success: false, error: err.message});
  }
});

router.post('/calendar-entries', (req, res) => {
  const payload = req.body ?? {};
  respond(
    res,
    prisma.calendarEntry
      .create({data: buildCalendarEntryData(payload)})
      .then(withStoredId)
  );
});

router.put('/calendar-entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  respond(
    res,
    prisma.calendarEntry
      .update({where: {id}, data: buildCalendarEntryData(payload)})
      .then(withStoredId)
  );
});

router.delete('/calendar-entries/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.calendarEntry.delete({where: {id}}).then(withStoredId));
});

router.post('/visits/journal', (req, res) => {
  const payload = req.body ?? {};
  respond(res, prisma.visit.create({data: buildVisitData(payload)}).then(withStoredId));
});

router.put('/visits/journal/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  respond(
    res,
    prisma.visit.update({where: {id}, data: buildVisitData(payload)}).then(withStoredId),
  );
});

router.delete('/visits/journal/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.delete({where: {id}}).then(withStoredId));
});

// ==================== Client ====================
router.get('/clients', (req, res) => {
  respond(
    res,
    prisma.client.findMany({
      select: clientSelect,
      orderBy: { name: 'asc' },
    })
  );
});

router.post('/clients', (req, res) => {
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  respond(res, prisma.client.create({ data, select: clientSelect }));
});

router.get('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.findUnique({ where: { id }, select: clientSelect }));
});

router.put('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  respond(res, prisma.client.update({ where: { id }, data, select: clientSelect }));
});

router.delete('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.delete({ where: { id } }));
});


// ==================== Service ====================
router.post('/services', (req, res) => {
  const data = buildServiceData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  respond(res, prisma.service.create({ data }).then(withStoredId));
});

router.get('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildServiceData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  respond(res, prisma.service.update({ where: { id }, data }).then(withStoredId));
});

router.delete('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.delete({ where: { id } }).then(withStoredId));
});

router.get('/services', (req, res) => {
  respond(
    res,
    prisma.service.findMany({orderBy: {name: 'asc'}}).then((records) =>
      records.map(withStoredId),
    ),
  );
});

// ==================== Employee ====================
router.post('/employees', (req, res) => {
  const data = buildEmployeeData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  respond(res, prisma.employee.create({ data }).then(withStoredId));
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildEmployeeData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  respond(res, prisma.employee.update({ where: { id }, data }).then(withStoredId));
});

router.delete('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.delete({ where: { id } }).then(withStoredId));
});

router.get('/employees', (req, res) => {
  respond(
    res,
    prisma.employee.findMany({orderBy: {name: 'asc'}}).then((records) =>
      records.map(withStoredId),
    ),
  );
});

// ==================== Visit ====================
router.post('/visits', (req, res) => {
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  respond(
    res,
    prisma.visit.create({
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
    })
  );
});

router.get('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.findUnique({ where: { id } }));
});

router.put('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  respond(
    res,
    prisma.visit.update({
      where: { id },
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        notes,
      },
    })
  );
});

router.delete('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.delete({ where: { id } }));
});

router.get('/visits', (req, res) => {
  respond(res, prisma.visit.findMany());
});

// ==================== Task ====================
router.post('/tasks', (req, res) => {
  const { title, description, dueDate, completed } = req.body;
  respond(
    res,
    prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: !!completed,
      },
    })
  );
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }));
});

router.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, description, dueDate, completed } = req.body;
  respond(
    res,
    prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: completed !== undefined ? !!completed : undefined,
      },
    })
  );
});

router.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.delete({ where: { id } }));
});

router.get('/tasks', (req, res) => {
  respond(res, prisma.task.findMany());
});

module.exports = router;
