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
  ...(record.payload && typeof record.payload === 'object' ? record.payload : {}),
  id: record.id,
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
  const { name, price, durationMin } = req.body;
  respond(res, prisma.service.create({ data: { name, price, durationMin } }));
});

router.get('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.findUnique({ where: { id } }));
});

router.put('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, price, durationMin } = req.body;
  respond(res, prisma.service.update({ where: { id }, data: { name, price, durationMin } }));
});

router.delete('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.delete({ where: { id } }));
});

router.get('/services', (req, res) => {
  respond(res, prisma.service.findMany());
});

// ==================== Employee ====================
router.post('/employees', (req, res) => {
  const { name, role, email } = req.body;
  respond(res, prisma.employee.create({ data: { name, role, email } }));
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }));
});

router.put('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, role, email } = req.body;
  respond(res, prisma.employee.update({ where: { id }, data: { name, role, email } }));
});

router.delete('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.delete({ where: { id } }));
});

router.get('/employees', (req, res) => {
  respond(res, prisma.employee.findMany());
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
