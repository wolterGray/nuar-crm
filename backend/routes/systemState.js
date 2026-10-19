const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { isOwnerAuth, requireOwner } = require('../middleware/auth');
const { recordAuditLog } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {
  respond,
  respondWithAudit,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

const SENSITIVE_SETTINGS_KEYS = [
  'telegramBotToken',
  'telegramChatId',
  'smsApiKey',
  'smsApiSecret',
  'smsSenderName',
  'gmailClientId',
  'gmailClientSecret',
  'gmailRefreshToken',
  'adminPassword',
  'adminEmail',
  'backupEncryptionKey',
  'backupKey',
];

const sanitizePayload = (key, payload, isOwner) => {
  if (isOwner) return payload;
  if (!payload || typeof payload !== 'object') return payload;

  if (key === 'settings') {
    const sanitized = { ...payload };
    for (const secretKey of SENSITIVE_SETTINGS_KEYS) {
      delete sanitized[secretKey];
    }
    return sanitized;
  }

  const lowerKey = String(key).toLowerCase();
  if (
    lowerKey.includes('secret') ||
    lowerKey.includes('token') ||
    lowerKey.includes('backup') ||
    lowerKey.includes('credential')
  ) {
    return null;
  }

  return payload;
};

// ==================== System state settings ====================
router.get('/system-state', async (req, res) => {
  try {
    const isOwner = isOwnerAuth(req.auth);
    const records = await prisma.systemState.findMany({ orderBy: { key: 'asc' } });
    const result = {};
    for (const record of records) {
      const sanitized = sanitizePayload(record.key, record.payload, isOwner);
      if (sanitized !== null) {
        result[record.key] = sanitized;
      }
    }
    res.json({ success: true, data: result });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.get('/system-state/:key', async (req, res) => {
  const key = String(req.params.key ?? '').trim();
  try {
    const isOwner = isOwnerAuth(req.auth);
    const record = await prisma.systemState.findUnique({ where: { key } });
    if (!record) {
      return res.json({ success: true, data: null });
    }
    const sanitized = sanitizePayload(key, record.payload, isOwner);
    if (sanitized === null && !isOwner) {
      return res.status(403).json({ success: false, error: 'Доступ к системным настройкам запрещён' });
    }
    res.json({ success: true, data: sanitized });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.put('/system-state/:key', requireOwner, async (req, res) => {
  const key = String(req.params.key ?? '').trim();
  const payload = req.body?.payload ?? req.body ?? null;

  if (!key) {
    return res.status(400).json({ success: false, error: 'System state key is required' });
  }

  const before = key
    ? await prisma.systemState.findUnique({ where: { key } }).then((record) => record?.payload ?? null)
    : null;

  respondWithAudit(
    prisma,
    req,
    res,
    prisma.systemState
      .upsert({
        where: { key },
        create: { key, payload },
        update: { payload },
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

router.put('/system-state', requireOwner, async (req, res) => {
  const entries = req.body?.entries ?? req.body ?? {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return res.status(400).json({ success: false, error: 'System state entries object is required' });
  }

  try {
    const beforeRecords = await prisma.systemState.findMany({
      where: { key: { in: Object.keys(entries) } },
    });
    const before = Object.fromEntries(beforeRecords.map(systemStateRecord));

    await prisma.$transaction(
      Object.entries(entries).map(([key, payload]) =>
        prisma.systemState.upsert({
          where: { key },
          create: { key, payload },
          update: { payload },
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

    res.json({ success: true, data: entries });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('System state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

router.SENSITIVE_SETTINGS_KEYS = SENSITIVE_SETTINGS_KEYS;
router.sanitizePayload = sanitizePayload;

module.exports = router;
