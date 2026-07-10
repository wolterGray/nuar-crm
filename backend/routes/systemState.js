const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {
  respond,
  respondWithAudit,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

const systemStateRecord = (record) => [record.key, record.payload];

// ==================== System state settings ====================
router.get('/system-state', (req, res) => {
  respond(
    res,
    prisma.systemState.findMany({ orderBy: { key: 'asc' } }).then((records) =>
      Object.fromEntries(records.map(systemStateRecord)),
    ),
  );
});

router.get('/system-state/:key', (req, res) => {
  const key = String(req.params.key ?? '').trim();
  respond(res, prisma.systemState.findUnique({ where: { key } }).then((record) => record?.payload ?? null));
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

module.exports = router;
