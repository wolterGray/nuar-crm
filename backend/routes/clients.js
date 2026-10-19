const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner, requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const { maskEmail, maskPhoneNumber } = require('../constants/permissions');
const {
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

const sanitizeClientRecord = (client, canViewContacts) => {
  if (!client) return client;
  if (canViewContacts) return client;

  return {
    ...client,
    phone: maskPhoneNumber(client.phone),
    email: maskEmail(client.email),
    instagram: client.instagram ? '***' : null,
    telegram: client.telegram ? '***' : null,
  };
};

// ==================== Client ====================
router.get('/clients', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      select: clientSelect,
      orderBy: { name: 'asc' },
    });

    const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
    res.json({
      success: true,
      data: clients.map((c) => sanitizeClientRecord(c, canViewContacts)),
    });
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/clients', requirePermission(PERMISSIONS.CLIENTS_MANAGE), (req, res) => {
  const data = buildClientData(req.body);
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Client name is required' });
  }

  auditCreate(prisma, req, res, prisma.client.create({ data, select: clientSelect }), 'Client', 'create client');
});

router.get('/clients/:id', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const client = await prisma.client.findUnique({ where: { id }, select: clientSelect });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
    res.json({
      success: true,
      data: sanitizeClientRecord(client, canViewContacts),
    });
  } catch (err) {
    console.error('Error fetching client by id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/clients/:id', requirePermission(PERMISSIONS.CLIENTS_MANAGE), async (req, res) => {
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

router.delete('/clients/:id', requirePermission(PERMISSIONS.CLIENTS_DELETE), async (req, res) => {
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
const sanitizeCommunicationLog = (log, canViewContacts) => {
  const base = withStoredId(log);
  if (canViewContacts || !base) return base;
  const p = base.payload && typeof base.payload === 'object' ? base.payload : {};
  return {
    ...base,
    recipient: maskPhoneNumber(maskEmail(base.recipient)),
    payload: {
      ...p,
      recipient: maskPhoneNumber(maskEmail(p.recipient)),
    },
  };
};

router.post('/communication-log', requirePermission(PERMISSIONS.CLIENTS_MANAGE), (req, res) => {
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

router.get('/communication-log/:id', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  const id = Number(req.params.id);
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const record = await prisma.communicationLog.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ success: false, error: 'Communication log not found' });
    res.json({ success: true, data: sanitizeCommunicationLog(record, canViewContacts) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/communication-log/:id', requirePermission(PERMISSIONS.CLIENTS_MANAGE), async (req, res) => {
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

router.get('/communication-log', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const records = await prisma.communicationLog.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: records.map((r) => sanitizeCommunicationLog(r, canViewContacts)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
