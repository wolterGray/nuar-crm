// backend/routes/crud.js
// CRUD routes for CRM data using Prisma.

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const prisma = new PrismaClient();

// ----- Helper for unified response -----
const respond = (res, promise) => {
  promise
    .then((data) => res.json({ success: true, data }))
    .catch((err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const respondWithAudit = (req, res, promise, audit) => {
  promise
    .then(async (data) => {
      await recordAuditLog(prisma, req, {
        ...audit,
        after: audit?.after === undefined ? data : audit.after,
        entityId: audit?.entityId ?? data?.id,
      });
      res.json({ success: true, data });
    })
    .catch(async (err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      await recordErrorEvent(prisma, {
        context: {
          action: audit?.action,
          entity: audit?.entity,
          params: req.params,
        },
        error: err,
        message: err.message,
        source: 'crud',
      });
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const findById = (model, id) => prisma[model].findUnique({where: {id}});

const auditCreate = (req, res, promise, entity, action) =>
  respondWithAudit(req, res, promise, {action, entity});

const auditUpdate = async (req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(model, id) : null;
  respondWithAudit(req, res, promise, {action, before, entity, entityId: id});
};

const auditDelete = async (req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(model, id) : null;
  respondWithAudit(req, res, promise, {
    action,
    after: null,
    before,
    entity,
    entityId: id,
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

const toDate = (date) => {
  if (!date) return null;

  const value = new Date(`${date}T00:00:00`);
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

const buildTaskData = (payload) => ({
  type: cleanOptionalString(payload?.type) || 'task',
  title: String(payload?.title ?? '').trim(),
  description: cleanOptionalString(payload?.description ?? payload?.note),
  note: cleanOptionalString(payload?.note),
  dueDate: toDate(payload?.dueDate),
  priority: cleanOptionalString(payload?.priority),
  status: cleanOptionalString(payload?.status),
  sortOrder:
    payload?.sortOrder !== undefined && payload?.sortOrder !== null
      ? Number(payload.sortOrder) || 0
      : null,
  completed:
    payload?.completed !== undefined
      ? Boolean(payload.completed)
      : payload?.status === 'completed',
  payload,
});

const buildWaitlistEntryData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  preferredDate: cleanOptionalString(payload?.preferredDate),
  preferredMaster: cleanOptionalString(payload?.preferredMaster),
  preferredService: cleanOptionalString(payload?.preferredService),
  preferredTimeFrom: cleanOptionalString(payload?.preferredTimeFrom),
  preferredTimeTo: cleanOptionalString(payload?.preferredTimeTo),
  status: cleanOptionalString(payload?.status) || 'active',
  note: cleanOptionalString(payload?.note),
  lastOfferedAt: payload?.lastOfferedAt ? new Date(payload.lastOfferedAt) : null,
  lastOfferedSlot: payload?.lastOfferedSlot ?? null,
  payload,
});

const buildSupplyData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  stock:
    payload?.stock !== undefined && payload?.stock !== null
      ? Number(payload.stock) || 0
      : null,
  minStock:
    payload?.minStock !== undefined && payload?.minStock !== null
      ? Number(payload.minStock) || 0
      : null,
  unit: cleanOptionalString(payload?.unit),
  cost:
    payload?.cost !== undefined && payload?.cost !== null
      ? Number(payload.cost) || 0
      : null,
  note: cleanOptionalString(payload?.note),
  orderUrl: cleanOptionalString(payload?.orderUrl),
  payload,
});

const buildMessageTemplateData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  channel: cleanOptionalString(payload?.channel),
  language: cleanOptionalString(payload?.language),
  audience: cleanOptionalString(payload?.audience),
  purpose: cleanOptionalString(payload?.purpose),
  subject: cleanOptionalString(payload?.subject),
  body: String(payload?.body ?? '').trim(),
  payload,
});

const buildCommunicationLogData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  channel: cleanOptionalString(payload?.channel),
  templateName: cleanOptionalString(payload?.templateName),
  body: cleanOptionalString(payload?.body),
  createdAt: payload?.createdAt ? new Date(payload.createdAt) : undefined,
  payload,
});

const buildPackageData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  service: cleanOptionalString(payload?.service),
  visitsCount:
    payload?.visitsCount !== undefined && payload?.visitsCount !== null
      ? Number(payload.visitsCount) || 0
      : null,
  price:
    payload?.price !== undefined && payload?.price !== null
      ? Number(payload.price) || 0
      : null,
  validityDays:
    payload?.validityDays !== undefined && payload?.validityDays !== null
      ? Number(payload.validityDays) || 0
      : null,
  status: cleanOptionalString(payload?.status),
  active: payload?.active !== undefined ? Boolean(payload.active) : payload?.status !== 'Неактивен',
  payload,
});

const buildClientPackageData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  packageId: payload?.packageId ? Number(payload.packageId) : null,
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  clientName: cleanOptionalString(payload?.client),
  packageName: cleanOptionalString(payload?.packageName),
  service: cleanOptionalString(payload?.service),
  totalVisits:
    payload?.totalVisits !== undefined && payload?.totalVisits !== null
      ? Number(payload.totalVisits) || 0
      : null,
  remainingVisits:
    payload?.remainingVisits !== undefined && payload?.remainingVisits !== null
      ? Number(payload.remainingVisits) || 0
      : null,
  price:
    payload?.price !== undefined && payload?.price !== null
      ? Number(payload.price) || 0
      : null,
  purchaseDate: cleanOptionalString(payload?.purchaseDate),
  expiryDate: cleanOptionalString(payload?.expiryDate),
  payment: cleanOptionalString(payload?.payment),
  status: cleanOptionalString(payload?.status),
  writeOffHistory: Array.isArray(payload?.writeOffHistory) ? payload.writeOffHistory : [],
  payload,
});

const buildCertificateData = (payload) => ({
  code: String(payload?.code ?? '').trim(),
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  recipientId: payload?.recipientId ? Number(payload.recipientId) : null,
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  saleVisitId: payload?.saleVisitId ? Number(payload.saleVisitId) : null,
  clientName: cleanOptionalString(payload?.client),
  recipientName: cleanOptionalString(payload?.recipient),
  nominal:
    payload?.nominal !== undefined && payload?.nominal !== null
      ? Number(payload.nominal) || 0
      : null,
  remainingBalance:
    payload?.remainingBalance !== undefined && payload?.remainingBalance !== null
      ? Number(payload.remainingBalance) || 0
      : null,
  purchaseDate: cleanOptionalString(payload?.purchaseDate),
  usedDate: cleanOptionalString(payload?.usedDate),
  expiryDate: cleanOptionalString(payload?.expiryDate),
  payment: cleanOptionalString(payload?.payment),
  status: cleanOptionalString(payload?.status),
  note: cleanOptionalString(payload?.note),
  payload,
});

const buildDayCloseRecordData = (payload) => {
  const payments = payload?.journal?.paymentsByMethod ?? {};

  return {
    date: String(payload?.date ?? '').trim(),
    cash: Number(payments.cash ?? payments['Наличные'] ?? payload?.cash ?? payload?.journal?.cashReceived) || 0,
    card: Number(payments.card ?? payments['Карта'] ?? payload?.card ?? payload?.journal?.cardReceived) || 0,
    blik: Number(payments.blik ?? payments['BLIK'] ?? payload?.blik) || 0,
    certificates: Number(payload?.certificates ?? payments.certificate ?? payments['Сертификат']) || 0,
    packages: Number(payload?.packages ?? payments.package ?? payments['Пакет']) || 0,
    total: Number(payload?.journal?.receivedRevenue ?? payload?.total) || 0,
    status: cleanOptionalString(payload?.status),
    note: cleanOptionalString(payload?.note),
    payload,
  };
};

const buildPayrollRecordData = (payload) => ({
  employeeId: payload?.employeeId ? Number(payload.employeeId) : null,
  employeeName: cleanOptionalString(payload?.employeeName),
  startDate: cleanOptionalString(payload?.startDate),
  endDate: cleanOptionalString(payload?.endDate),
  periodKey: String(payload?.periodKey ?? '').trim(),
  amount: Number(payload?.amount ?? payload?.report?.totals?.totalPayout) || 0,
  status: cleanOptionalString(payload?.status),
  paidAt: payload?.paidAt ? new Date(payload.paidAt) : null,
  note: cleanOptionalString(payload?.note),
  payload,
});

const systemStateRecord = (record) => [record.key, record.payload];

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
  auditCreate(
    req,
    res,
    prisma.calendarEntry
      .create({data: buildCalendarEntryData(payload)})
      .then(withStoredId),
    'CalendarEntry',
    payload.kind === 'visit' ? 'create visit' : 'create calendar entry',
  );
});

router.put('/calendar-entries/:id', (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  auditUpdate(
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry
      .update({where: {id}, data: buildCalendarEntryData(payload)})
      .then(withStoredId)
    ,
    'CalendarEntry',
    payload.kind === 'visit' ? 'update visit' : 'update calendar entry',
  );
});

router.delete('/calendar-entries/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'calendarEntry',
    id,
    prisma.calendarEntry.delete({where: {id}}).then(withStoredId),
    'CalendarEntry',
    'delete/cancel visit',
  );
});

router.post('/visits/journal', (req, res) => {
  const payload = req.body ?? {};
  auditCreate(
    req,
    res,
    prisma.visit.create({data: buildVisitData(payload)}).then(withStoredId),
    'Visit',
    payload.recordType === 'operation' ? 'create payment' : 'create visit',
  );
});

router.put('/visits/journal/:id', async (req, res) => {
  const id = Number(req.params.id);
  const payload = {...(req.body ?? {}), id};
  await auditUpdate(
    req,
    res,
    'visit',
    id,
    prisma.visit.update({where: {id}, data: buildVisitData(payload)}).then(withStoredId),
    'Visit',
    payload.recordType === 'operation' ? 'update payment' : 'update visit',
  );
});

router.delete('/visits/journal/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'visit',
    id,
    prisma.visit.delete({where: {id}}).then(withStoredId),
    'Visit',
    'delete/cancel visit',
  );
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

  auditCreate(req, res, prisma.client.create({ data, select: clientSelect }), 'Client', 'create client');
});

router.get('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.findUnique({ where: { id }, select: clientSelect }));
});

router.put('/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  await auditUpdate(
    req,
    res,
    'client',
    id,
    prisma.client.update({ where: { id }, data, select: clientSelect }),
    'Client',
    'update client',
  );
});

router.delete('/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'client',
    id,
    prisma.client.delete({ where: { id } }),
    'Client',
    'delete/archive client',
  );
});


// ==================== Service ====================
router.post('/services', (req, res) => {
  const data = buildServiceData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  auditCreate(req, res, prisma.service.create({ data }).then(withStoredId), 'Service', 'create service');
});

router.get('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/services/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildServiceData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  await auditUpdate(
    req,
    res,
    'service',
    id,
    prisma.service.update({ where: { id }, data }).then(withStoredId),
    'Service',
    'update service',
  );
});

router.delete('/services/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'service',
    id,
    prisma.service.delete({ where: { id } }).then(withStoredId),
    'Service',
    'delete service',
  );
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

  auditCreate(req, res, prisma.employee.create({ data }).then(withStoredId), 'Employee', 'create employee');
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildEmployeeData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Employee name is required' });
  }

  await auditUpdate(
    req,
    res,
    'employee',
    id,
    prisma.employee.update({ where: { id }, data }).then(withStoredId),
    'Employee',
    'update employee',
  );
});

router.delete('/employees/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'employee',
    id,
    prisma.employee.delete({ where: { id } }).then(withStoredId),
    'Employee',
    'delete employee',
  );
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
  auditCreate(
    req,
    res,
    prisma.visit.create({
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
    }),
    'Visit',
    'create visit',
  );
});

router.get('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.findUnique({ where: { id } }));
});

router.put('/visits/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  await auditUpdate(
    req,
    res,
    'visit',
    id,
    prisma.visit.update({
      where: { id },
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        notes,
      },
    }),
    'Visit',
    'update visit',
  );
});

router.delete('/visits/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'visit',
    id,
    prisma.visit.delete({ where: { id } }),
    'Visit',
    'delete/cancel visit',
  );
});

router.get('/visits', (req, res) => {
  respond(res, prisma.visit.findMany());
});

// ==================== Task ====================
router.post('/tasks', (req, res) => {
  const data = buildTaskData(req.body ?? {});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  auditCreate(req, res, prisma.task.create({data}).then(withStoredId), 'Task', 'create task');
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildTaskData({...(req.body ?? {}), id});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  await auditUpdate(
    req,
    res,
    'task',
    id,
    prisma.task.update({where: {id}, data}).then(withStoredId),
    'Task',
    'update task',
  );
});

router.delete('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'task',
    id,
    prisma.task.delete({ where: { id } }).then(withStoredId),
    'Task',
    'delete task',
  );
});

router.get('/tasks', (req, res) => {
  respond(
    res,
    prisma.task
      .findMany({orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}]})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Waitlist ====================
router.post('/waitlist', (req, res) => {
  const data = buildWaitlistEntryData(req.body ?? {});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  auditCreate(
    req,
    res,
    prisma.waitlistEntry.create({data}).then(withStoredId),
    'WaitlistEntry',
    'create waitlist entry',
  );
});

router.get('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.waitlistEntry.findUnique({where: {id}}).then(withStoredId));
});

router.put('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildWaitlistEntryData({...(req.body ?? {}), id});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  await auditUpdate(
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({where: {id}, data}).then(withStoredId),
    'WaitlistEntry',
    'update waitlist entry',
  );
});

router.delete('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.delete({where: {id}}).then(withStoredId),
    'WaitlistEntry',
    'delete waitlist entry',
  );
});

router.get('/waitlist', (req, res) => {
  respond(
    res,
    prisma.waitlistEntry
      .findMany({orderBy: {createdAt: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Supply ====================
router.post('/supplies', (req, res) => {
  const data = buildSupplyData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  auditCreate(req, res, prisma.supply.create({data}).then(withStoredId), 'Supply', 'create supply');
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({where: {id}}).then(withStoredId));
});

router.put('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildSupplyData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  await auditUpdate(
    req,
    res,
    'supply',
    id,
    prisma.supply.update({where: {id}, data}).then(withStoredId),
    'Supply',
    'update supply',
  );
});

router.delete('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'supply',
    id,
    prisma.supply.delete({where: {id}}).then(withStoredId),
    'Supply',
    'delete supply',
  );
});

router.get('/supplies', (req, res) => {
  respond(
    res,
    prisma.supply
      .findMany({orderBy: {name: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Operations state and messaging ====================
router.get('/operations-state', async (req, res) => {
  try {
    const [
      tasks,
      supplies,
      waitlistEntries,
      messageTemplates,
      communicationLog,
    ] = await Promise.all([
      prisma.task
        .findMany({orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}]}),
      prisma.supply.findMany({orderBy: {name: 'asc'}}),
      prisma.waitlistEntry.findMany({orderBy: {createdAt: 'asc'}}),
      prisma.messageTemplate.findMany({orderBy: {name: 'asc'}}),
      prisma.communicationLog.findMany({orderBy: {createdAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        communicationLog: communicationLog.map(withStoredId),
        messageTemplates: messageTemplates.map(withStoredId),
        supplies: supplies.map(withStoredId),
        tasks: tasks.map(withStoredId),
        waitlistEntries: waitlistEntries.map(withStoredId),
      },
    });
  } catch (err) {
    console.error('Operations state error:', err);
    res.status(400).json({success: false, error: err.message});
  }
});

router.post('/message-templates', (req, res) => {
  const data = buildMessageTemplateData(req.body ?? {});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  auditCreate(
    req,
    res,
    prisma.messageTemplate.create({data}).then(withStoredId),
    'MessageTemplate',
    'create message template',
  );
});

router.get('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/message-templates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildMessageTemplateData({...(req.body ?? {}), id});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  await auditUpdate(
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.update({where: {id}, data}).then(withStoredId),
    'MessageTemplate',
    'update message template',
  );
});

router.delete('/message-templates/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.delete({where: {id}}).then(withStoredId),
    'MessageTemplate',
    'delete message template',
  );
});

router.get('/message-templates', (req, res) => {
  respond(
    res,
    prisma.messageTemplate
      .findMany({orderBy: {name: 'asc'}})
      .then((records) => records.map(withStoredId)),
  );
});

router.post('/communication-log', (req, res) => {
  const data = buildCommunicationLogData(req.body ?? {});
  if (!data.clientName && !data.body) {
    return res.status(400).json({ success: false, error: 'Communication log entry is empty' });
  }

  auditCreate(
    req,
    res,
    prisma.communicationLog.create({data}).then(withStoredId),
    'CommunicationLog',
    'create communication log',
  );
});

router.get('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.communicationLog.findUnique({where: {id}}).then(withStoredId));
});

router.put('/communication-log/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCommunicationLogData({...(req.body ?? {}), id});
  await auditUpdate(
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.update({where: {id}, data}).then(withStoredId),
    'CommunicationLog',
    'update communication log',
  );
});

router.delete('/communication-log/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.delete({where: {id}}).then(withStoredId),
    'CommunicationLog',
    'delete communication log',
  );
});

router.get('/communication-log', (req, res) => {
  respond(
    res,
    prisma.communicationLog
      .findMany({orderBy: {createdAt: 'desc'}})
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Financial core ====================
router.get('/financial-state', async (req, res) => {
  try {
    const [
      packages,
      clientPackages,
      certificates,
      dayCloseRecords,
      payrollRecords,
    ] = await Promise.all([
      prisma.package.findMany({orderBy: {name: 'asc'}}),
      prisma.clientPackage.findMany({orderBy: {createdAt: 'desc'}}),
      prisma.certificate.findMany({orderBy: {createdAt: 'desc'}}),
      prisma.dayCloseRecord.findMany({orderBy: {date: 'desc'}}),
      prisma.payrollRecord.findMany({orderBy: {paidAt: 'desc'}}),
    ]);

    res.json({
      success: true,
      data: {
        packages: packages.map(withStoredId),
        clientPackages: clientPackages.map(withStoredId),
        certificates: certificates.map(withStoredId),
        dayCloseRecords: dayCloseRecords.map(withStoredId),
        payrollRecords: payrollRecords.map(withStoredId),
      },
    });
  } catch (err) {
    console.error('Financial state error:', err);
    res.status(400).json({success: false, error: err.message});
  }
});

router.post('/packages', (req, res) => {
  const data = buildPackageData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({success: false, error: 'Package name is required'});
  }

  auditCreate(req, res, prisma.package.create({data}).then(withStoredId), 'Package', 'create package');
});

router.get('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.package.findUnique({where: {id}}).then(withStoredId));
});

router.put('/packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildPackageData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({success: false, error: 'Package name is required'});
  }

  await auditUpdate(
    req,
    res,
    'package',
    id,
    prisma.package.update({where: {id}, data}).then(withStoredId),
    'Package',
    'update package',
  );
});

router.delete('/packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'package',
    id,
    prisma.package.delete({where: {id}}).then(withStoredId),
    'Package',
    'delete package',
  );
});

router.get('/packages', (req, res) => {
  respond(res, prisma.package.findMany({orderBy: {name: 'asc'}}).then((records) => records.map(withStoredId)));
});

router.post('/client-packages', (req, res) => {
  const data = buildClientPackageData(req.body ?? {});
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  auditCreate(
    req,
    res,
    prisma.clientPackage.create({data}).then(withStoredId),
    'ClientPackage',
    'create package sale',
  );
});

router.get('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.clientPackage.findUnique({where: {id}}).then(withStoredId));
});

router.put('/client-packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientPackageData({...(req.body ?? {}), id});
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  await auditUpdate(
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.update({where: {id}, data}).then(withStoredId),
    'ClientPackage',
    'use package',
  );
});

router.delete('/client-packages/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'clientPackage',
    id,
    prisma.clientPackage.delete({where: {id}}).then(withStoredId),
    'ClientPackage',
    'delete package sale',
  );
});

router.get('/client-packages', (req, res) => {
  respond(res, prisma.clientPackage.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/certificates', (req, res) => {
  const data = buildCertificateData(req.body ?? {});
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  auditCreate(
    req,
    res,
    prisma.certificate.create({data}).then(withStoredId),
    'Certificate',
    'create certificate',
  );
});

router.get('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.certificate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/certificates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCertificateData({...(req.body ?? {}), id});
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  await auditUpdate(
    req,
    res,
    'certificate',
    id,
    prisma.certificate.update({where: {id}, data}).then(withStoredId),
    'Certificate',
    'use certificate',
  );
});

router.delete('/certificates/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'certificate',
    id,
    prisma.certificate.delete({where: {id}}).then(withStoredId),
    'Certificate',
    'delete certificate',
  );
});

router.get('/certificates', (req, res) => {
  respond(res, prisma.certificate.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/day-close-records', (req, res) => {
  const data = buildDayCloseRecordData(req.body ?? {});
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  auditCreate(
    req,
    res,
    prisma.dayCloseRecord.create({data}).then(withStoredId),
    'DayCloseRecord',
    'create day close',
  );
});

router.put('/day-close-records/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildDayCloseRecordData({...(req.body ?? {}), id});
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  await auditUpdate(
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.update({where: {id}, data}).then(withStoredId),
    'DayCloseRecord',
    'update day close',
  );
});

router.delete('/day-close-records/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'dayCloseRecord',
    id,
    prisma.dayCloseRecord.delete({where: {id}}).then(withStoredId),
    'DayCloseRecord',
    'delete day close',
  );
});

router.get('/day-close-records', (req, res) => {
  respond(res, prisma.dayCloseRecord.findMany({orderBy: {date: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/payroll-records', (req, res) => {
  const data = buildPayrollRecordData(req.body ?? {});
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  auditCreate(
    req,
    res,
    prisma.payrollRecord.create({data}).then(withStoredId),
    'PayrollRecord',
    'create payroll record',
  );
});

router.put('/payroll-records/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildPayrollRecordData({...(req.body ?? {}), id});
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  await auditUpdate(
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.update({where: {id}, data}).then(withStoredId),
    'PayrollRecord',
    'update payroll record',
  );
});

router.delete('/payroll-records/:id', async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    req,
    res,
    'payrollRecord',
    id,
    prisma.payrollRecord.delete({where: {id}}).then(withStoredId),
    'PayrollRecord',
    'delete payroll record',
  );
});

router.get('/payroll-records', (req, res) => {
  respond(res, prisma.payrollRecord.findMany({orderBy: {paidAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

// ==================== System state ====================
router.get('/system-state', (req, res) => {
  respond(
    res,
    prisma.systemState.findMany({orderBy: {key: 'asc'}}).then((records) =>
      Object.fromEntries(records.map(systemStateRecord)),
    ),
  );
});

router.get('/system-state/:key', (req, res) => {
  const key = String(req.params.key ?? '').trim();
  respond(res, prisma.systemState.findUnique({where: {key}}).then((record) => record?.payload ?? null));
});

router.put('/system-state/:key', async (req, res) => {
  const key = String(req.params.key ?? '').trim();
  const payload = req.body?.payload ?? req.body ?? null;

  if (!key) {
    return res.status(400).json({success: false, error: 'System state key is required'});
  }

  const before = key
    ? await prisma.systemState.findUnique({where: {key}}).then((record) => record?.payload ?? null)
    : null;

  respondWithAudit(
    req,
    res,
    prisma.systemState
      .upsert({
        where: {key},
        create: {key, payload},
        update: {payload},
      })
      .then((record) => record.payload),
    {
      action: 'update settings',
      before,
      entity: 'SystemState',
      entityId: key,
    },
  );
});

router.put('/system-state', async (req, res) => {
  const entries = req.body?.entries ?? req.body ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return res.status(400).json({success: false, error: 'System state entries object is required'});
  }

  try {
    const beforeRecords = await prisma.systemState.findMany({
      where: {key: {in: Object.keys(entries)}},
    });
    const before = Object.fromEntries(beforeRecords.map(systemStateRecord));

    await prisma.$transaction(
      Object.entries(entries).map(([key, payload]) =>
        prisma.systemState.upsert({
          where: {key},
          create: {key, payload},
          update: {payload},
        }),
      ),
    );

    await recordAuditLog(prisma, req, {
      action: 'update settings',
      after: entries,
      before,
      entity: 'SystemState',
      entityId: 'bulk',
    });

    res.json({success: true, data: entries});
  } catch (err) {
    console.error('System state error:', err);
    res.status(400).json({success: false, error: err.message});
  }
});

module.exports = router;
