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
  const data = buildTaskData(req.body ?? {});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  respond(res, prisma.task.create({data}).then(withStoredId));
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildTaskData({...(req.body ?? {}), id});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  respond(res, prisma.task.update({where: {id}, data}).then(withStoredId));
});

router.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.delete({ where: { id } }).then(withStoredId));
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

  respond(res, prisma.waitlistEntry.create({data}).then(withStoredId));
});

router.get('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.waitlistEntry.findUnique({where: {id}}).then(withStoredId));
});

router.put('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildWaitlistEntryData({...(req.body ?? {}), id});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  respond(res, prisma.waitlistEntry.update({where: {id}, data}).then(withStoredId));
});

router.delete('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.waitlistEntry.delete({where: {id}}).then(withStoredId));
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

  respond(res, prisma.supply.create({data}).then(withStoredId));
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({where: {id}}).then(withStoredId));
});

router.put('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildSupplyData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  respond(res, prisma.supply.update({where: {id}, data}).then(withStoredId));
});

router.delete('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.delete({where: {id}}).then(withStoredId));
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

  respond(res, prisma.messageTemplate.create({data}).then(withStoredId));
});

router.get('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildMessageTemplateData({...(req.body ?? {}), id});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  respond(res, prisma.messageTemplate.update({where: {id}, data}).then(withStoredId));
});

router.delete('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.delete({where: {id}}).then(withStoredId));
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

  respond(res, prisma.communicationLog.create({data}).then(withStoredId));
});

router.get('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.communicationLog.findUnique({where: {id}}).then(withStoredId));
});

router.put('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildCommunicationLogData({...(req.body ?? {}), id});
  respond(res, prisma.communicationLog.update({where: {id}, data}).then(withStoredId));
});

router.delete('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.communicationLog.delete({where: {id}}).then(withStoredId));
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

  respond(res, prisma.package.create({data}).then(withStoredId));
});

router.get('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.package.findUnique({where: {id}}).then(withStoredId));
});

router.put('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildPackageData({...(req.body ?? {}), id});
  if (!data.name) {
    return res.status(400).json({success: false, error: 'Package name is required'});
  }

  respond(res, prisma.package.update({where: {id}, data}).then(withStoredId));
});

router.delete('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.package.delete({where: {id}}).then(withStoredId));
});

router.get('/packages', (req, res) => {
  respond(res, prisma.package.findMany({orderBy: {name: 'asc'}}).then((records) => records.map(withStoredId)));
});

router.post('/client-packages', (req, res) => {
  const data = buildClientPackageData(req.body ?? {});
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  respond(res, prisma.clientPackage.create({data}).then(withStoredId));
});

router.get('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.clientPackage.findUnique({where: {id}}).then(withStoredId));
});

router.put('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildClientPackageData({...(req.body ?? {}), id});
  if (!data.clientName || !data.packageName) {
    return res.status(400).json({success: false, error: 'Client package requires client and package'});
  }

  respond(res, prisma.clientPackage.update({where: {id}, data}).then(withStoredId));
});

router.delete('/client-packages/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.clientPackage.delete({where: {id}}).then(withStoredId));
});

router.get('/client-packages', (req, res) => {
  respond(res, prisma.clientPackage.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/certificates', (req, res) => {
  const data = buildCertificateData(req.body ?? {});
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  respond(res, prisma.certificate.create({data}).then(withStoredId));
});

router.get('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.certificate.findUnique({where: {id}}).then(withStoredId));
});

router.put('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildCertificateData({...(req.body ?? {}), id});
  if (!data.code || !data.clientName) {
    return res.status(400).json({success: false, error: 'Certificate code and client are required'});
  }

  respond(res, prisma.certificate.update({where: {id}, data}).then(withStoredId));
});

router.delete('/certificates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.certificate.delete({where: {id}}).then(withStoredId));
});

router.get('/certificates', (req, res) => {
  respond(res, prisma.certificate.findMany({orderBy: {createdAt: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/day-close-records', (req, res) => {
  const data = buildDayCloseRecordData(req.body ?? {});
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  respond(res, prisma.dayCloseRecord.create({data}).then(withStoredId));
});

router.put('/day-close-records/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildDayCloseRecordData({...(req.body ?? {}), id});
  if (!data.date) {
    return res.status(400).json({success: false, error: 'Day close date is required'});
  }

  respond(res, prisma.dayCloseRecord.update({where: {id}, data}).then(withStoredId));
});

router.delete('/day-close-records/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.dayCloseRecord.delete({where: {id}}).then(withStoredId));
});

router.get('/day-close-records', (req, res) => {
  respond(res, prisma.dayCloseRecord.findMany({orderBy: {date: 'desc'}}).then((records) => records.map(withStoredId)));
});

router.post('/payroll-records', (req, res) => {
  const data = buildPayrollRecordData(req.body ?? {});
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  respond(res, prisma.payrollRecord.create({data}).then(withStoredId));
});

router.put('/payroll-records/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = buildPayrollRecordData({...(req.body ?? {}), id});
  if (!data.periodKey) {
    return res.status(400).json({success: false, error: 'Payroll period is required'});
  }

  respond(res, prisma.payrollRecord.update({where: {id}, data}).then(withStoredId));
});

router.delete('/payroll-records/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.payrollRecord.delete({where: {id}}).then(withStoredId));
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

router.put('/system-state/:key', (req, res) => {
  const key = String(req.params.key ?? '').trim();
  const payload = req.body?.payload ?? req.body ?? null;

  if (!key) {
    return res.status(400).json({success: false, error: 'System state key is required'});
  }

  respond(
    res,
    prisma.systemState
      .upsert({
        where: {key},
        create: {key, payload},
        update: {payload},
      })
      .then((record) => record.payload),
  );
});

router.put('/system-state', async (req, res) => {
  const entries = req.body?.entries ?? req.body ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return res.status(400).json({success: false, error: 'System state entries object is required'});
  }

  try {
    await prisma.$transaction(
      Object.entries(entries).map(([key, payload]) =>
        prisma.systemState.upsert({
          where: {key},
          create: {key, payload},
          update: {payload},
        }),
      ),
    );

    res.json({success: true, data: entries});
  } catch (err) {
    console.error('System state error:', err);
    res.status(400).json({success: false, error: err.message});
  }
});

module.exports = router;
