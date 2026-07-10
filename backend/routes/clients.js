const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  clientSelect,
  cleanOptionalString,
  getRouteId,
  withStoredId,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

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

const buildCommunicationLogData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  channel: cleanOptionalString(payload?.channel),
  templateName: cleanOptionalString(payload?.templateName),
  body: cleanOptionalString(payload?.body),
  createdAt: payload?.createdAt ? new Date(payload.createdAt) : undefined,
  payload,
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

  auditCreate(prisma, req, res, prisma.client.create({ data, select: clientSelect }), 'Client', 'create client');
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
    prisma,
    req,
    res,
    'client',
    id,
    prisma.client.update({ where: { id }, data, select: clientSelect }),
    'Client',
    'update client',
  );
});

router.delete('/clients/:id', requireOwner, async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'client',
    id,
    prisma.client.delete({ where: { id } }),
    'Client',
    'delete/archive client',
  );
});

// ==================== Communication Log ====================
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
