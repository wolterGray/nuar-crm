const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  withStoredId,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

const toDate = (date) => {
  if (!date) return null;
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? null : value;
};

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
        .findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      prisma.supply.findMany({ orderBy: { name: 'asc' } }),
      prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.messageTemplate.findMany({ orderBy: { name: 'asc' } }),
      prisma.communicationLog.findMany({ orderBy: { createdAt: 'desc' } }),
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
    const response = getHttpErrorResponse(err);
    console.error('Operations state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// ==================== Task CRUD ====================
router.post('/tasks', (req, res) => {
  const data = buildTaskData(req.body ?? {});
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  auditCreate(prisma, req, res, prisma.task.create({ data }).then(withStoredId), 'Task', 'create task');
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildTaskData({ ...(req.body ?? {}), id });
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'task',
    id,
    prisma.task.update({ where: { id }, data }).then(withStoredId),
    'Task',
    'update task',
  );
});

router.delete('/tasks/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
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
      .findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Waitlist CRUD ====================
router.post('/waitlist', (req, res) => {
  const data = buildWaitlistEntryData(req.body ?? {});
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.waitlistEntry.create({ data }).then(withStoredId),
    'WaitlistEntry',
    'create waitlist entry',
  );
});

router.get('/waitlist/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.waitlistEntry.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildWaitlistEntryData({ ...(req.body ?? {}), id });
  if (!data.clientId || !data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({ where: { id }, data }).then(withStoredId),
    'WaitlistEntry',
    'update waitlist entry',
  );
});

router.delete('/waitlist/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.delete({ where: { id } }).then(withStoredId),
    'WaitlistEntry',
    'delete waitlist entry',
  );
});

router.get('/waitlist', (req, res) => {
  respond(
    res,
    prisma.waitlistEntry
      .findMany({ orderBy: { createdAt: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Supplies CRUD ====================
router.post('/supplies', (req, res) => {
  const data = buildSupplyData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  auditCreate(prisma, req, res, prisma.supply.create({ data }).then(withStoredId), 'Supply', 'create supply');
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildSupplyData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'supply',
    id,
    prisma.supply.update({ where: { id }, data }).then(withStoredId),
    'Supply',
    'update supply',
  );
});

router.delete('/supplies/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'supply',
    id,
    prisma.supply.delete({ where: { id } }).then(withStoredId),
    'Supply',
    'delete supply',
  );
});

router.get('/supplies', (req, res) => {
  respond(
    res,
    prisma.supply
      .findMany({ orderBy: { name: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Message Templates CRUD ====================
router.post('/message-templates', (req, res) => {
  const data = buildMessageTemplateData(req.body ?? {});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.messageTemplate.create({ data }).then(withStoredId),
    'MessageTemplate',
    'create message template',
  );
});

router.get('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/message-templates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildMessageTemplateData({ ...(req.body ?? {}), id });
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.update({ where: { id }, data }).then(withStoredId),
    'MessageTemplate',
    'update message template',
  );
});

router.delete('/message-templates/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.delete({ where: { id } }).then(withStoredId),
    'MessageTemplate',
    'delete message template',
  );
});

router.get('/message-templates', (req, res) => {
  respond(
    res,
    prisma.messageTemplate
      .findMany({ orderBy: { name: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Communication Log CRUD ====================
router.post('/communication-log', (req, res) => {
  const data = buildCommunicationLogData(req.body ?? {});
  if (!data.clientName && !data.body) {
    return res.status(400).json({ success: false, error: 'Communication log entry is empty' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.communicationLog.create({ data }).then(withStoredId),
    'CommunicationLog',
    'create communication log',
  );
});

router.get('/communication-log/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.communicationLog.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/communication-log/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCommunicationLogData({ ...(req.body ?? {}), id });
  await auditUpdate(
    prisma,
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.update({ where: { id }, data }).then(withStoredId),
    'CommunicationLog',
    'update communication log',
  );
});

router.delete('/communication-log/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.delete({ where: { id } }).then(withStoredId),
    'CommunicationLog',
    'delete communication log',
  );
});

router.get('/communication-log', (req, res) => {
  respond(
    res,
    prisma.communicationLog
      .findMany({ orderBy: { createdAt: 'desc' } })
      .then((records) => records.map(withStoredId)),
  );
});

module.exports = router;
