const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const {
  applyTransaction,
  buildPublicUrl,
  createCardForClient,
  createUniqueTokenPayload,
  findCardForClient,
  getActorUserId,
  getPublicCardByToken,
  isOwner,
  serializeCard,
  serializeTransaction,
  validationError,
} = require('../services/loyaltyService');
const { getHttpErrorResponse } = require('../utils/httpErrors');

const prisma = new PrismaClient();
const router = express.Router();
const publicRouter = express.Router();

const PUBLIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PUBLIC_RATE_LIMIT_MAX = 30;
const publicHits = new Map();

const getIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();

const publicRateLimit = (req, res, next) => {
  const now = Date.now();
  const ip = getIp(req);
  const bucket = publicHits.get(ip) || { count: 0, resetAt: now + PUBLIC_RATE_LIMIT_WINDOW_MS };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + PUBLIC_RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  publicHits.set(ip, bucket);

  if (bucket.count > PUBLIC_RATE_LIMIT_MAX) {
    res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, error: 'Card unavailable' });
  }

  return next();
};

const sendRouteError = async (req, res, error, source = 'loyalty') => {
  const response = getHttpErrorResponse(error);
  await recordErrorEvent(prisma, {
    context: {
      params: req.params,
      path: req.originalUrl,
    },
    error,
    message: error.message,
    source,
  });
  res.status(response.status).json({ success: false, error: response.message });
};

const parseId = (value, fieldName = 'id') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError(`${fieldName} is invalid`);
  }
  return id;
};

const requireReason = (value, fieldName = 'description') => {
  const description = String(value ?? '').trim();
  if (!description) {
    throw validationError(`${fieldName} is required`);
  }
  return description;
};

const recordLoyaltyAudit = (tx, req, { action, after = null, before = null, entityId = null }) =>
  recordAuditLog(tx, req, {
    action,
    after,
    before,
    entity: 'LoyaltyCard',
    entityId,
  });

const serializeAppliedTransaction = (result) => ({
  card: serializeCard(result.card),
  transaction: serializeTransaction(result.transaction),
});

const serializeAdminCard = (card) => ({
  ...serializeCard(card),
  client: card.client
    ? {
        id: card.client.id,
        name: card.client.name,
        phone: card.client.phone,
        smsName: card.client.messageName,
      }
    : null,
});

publicRouter.get('/loyalty/:token', publicRateLimit, async (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'private, no-store');

  try {
    const data = await getPublicCardByToken(prisma, req.params.token);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Card unavailable',
        data: {
          cardStatus: 'unavailable',
        },
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Public loyalty card error:', error.message);
    return res.status(404).json({
      success: false,
      error: 'Card unavailable',
      data: {
        cardStatus: 'unavailable',
      },
    });
  }
});

router.post('/loyalty/cards/:clientId/create', async (req, res) => {
  try {
    const clientId = parseId(req.params.clientId, 'clientId');
    const cardLanguage = req.body?.cardLanguage;
    const result = await prisma.$transaction(async (tx) => {
      const created = await createCardForClient(tx, clientId, { cardLanguage });
      await recordLoyaltyAudit(tx, req, {
        action: 'create loyalty card',
        after: serializeCard(created.card),
        entityId: created.card.id,
      });
      return created;
    });

    res.status(201).json({
      success: true,
      data: {
        card: serializeCard(result.card, result.publicToken),
        publicUrl: result.publicUrl,
      },
    });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.get('/loyalty/cards/client/:clientId', async (req, res) => {
  try {
    const clientId = parseId(req.params.clientId, 'clientId');
    const card = await findCardForClient(prisma, clientId);
    res.json({ success: true, data: card ? serializeCard(card) : null });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.get('/loyalty/cards', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? 'all').trim();
    const reward = String(req.query.reward ?? 'all').trim();

    const where = {
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
      ...(reward === 'available' ? { rewardAvailable: true } : {}),
      ...(search
        ? {
            client: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { messageName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.loyaltyCard.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true, messageName: true } },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ rewardAvailable: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loyaltyCard.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map(serializeAdminCard),
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.get('/loyalty/cards/:cardId/transactions', async (req, res) => {
  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const [items, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { loyaltyCardId: cardId },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loyaltyTransaction.count({ where: { loyaltyCardId: cardId } }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map(serializeTransaction),
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.post('/loyalty/cards/:cardId/earn', async (req, res) => {
  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const description = requireReason(req.body?.description);
    const appointmentId = req.body?.appointmentId ? parseId(req.body.appointmentId, 'appointmentId') : null;
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.loyaltyCard.findUnique({ where: { id: cardId } });
      const applied = await applyTransaction(tx, {
        amount: 1,
        appointmentId,
        cardId,
        createdById: getActorUserId(req),
        description,
        type: 'EARN',
      });
      await recordLoyaltyAudit(tx, req, {
        action: 'manual loyalty earn',
        after: {
          card: serializeCard(applied.card),
          transaction: serializeTransaction(applied.transaction),
        },
        before: serializeCard(before),
        entityId: cardId,
      });
      return applied;
    });
    res.json({ success: true, data: serializeAppliedTransaction(result) });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.post('/loyalty/cards/:cardId/redeem', async (req, res) => {
  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const description = String(req.body?.description ?? 'Использование награды').trim();
    const result = await prisma.$transaction(async (tx) => {
      const card = await tx.loyaltyCard.findUnique({ where: { id: cardId } });
      if (!card) throw validationError('Loyalty card not found', 404);
      const amount = -Math.max(1, card.targetStamps || 5);
      const applied = await applyTransaction(tx, {
        amount,
        cardId,
        createdById: getActorUserId(req),
        description,
        type: 'REDEEM',
      });
      await recordLoyaltyAudit(tx, req, {
        action: 'redeem loyalty reward',
        after: {
          card: serializeCard(applied.card),
          transaction: serializeTransaction(applied.transaction),
        },
        before: serializeCard(card),
        entityId: cardId,
      });
      return applied;
    });
    res.json({ success: true, data: serializeAppliedTransaction(result) });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.post('/loyalty/cards/:cardId/correct', async (req, res) => {
  if (!isOwner(req)) {
    return res.status(403).json({ success: false, error: 'Owner role required' });
  }

  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount === 0) {
      throw validationError('amount must be a non-zero integer');
    }
    const description = requireReason(req.body?.description);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.loyaltyCard.findUnique({ where: { id: cardId } });
      const applied = await applyTransaction(tx, {
        amount,
        cardId,
        createdById: getActorUserId(req),
        description,
        type: 'CORRECTION',
      });
      await recordLoyaltyAudit(tx, req, {
        action: 'correct loyalty balance',
        after: {
          card: serializeCard(applied.card),
          transaction: serializeTransaction(applied.transaction),
        },
        before: serializeCard(before),
        entityId: cardId,
      });
      return applied;
    });
    res.json({ success: true, data: serializeAppliedTransaction(result) });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.post('/loyalty/cards/:cardId/reissue-link', async (req, res) => {
  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.loyaltyCard.findUnique({ where: { id: cardId } });
      if (!before) throw validationError('Loyalty card not found', 404);
      const { publicToken, publicTokenHash } = await createUniqueTokenPayload(tx);
      const card = await tx.loyaltyCard.update({
        where: { id: cardId },
        data: { publicToken, publicTokenHash },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      await recordLoyaltyAudit(tx, req, {
        action: 'reissue loyalty link',
        after: serializeCard(card),
        before: serializeCard(before),
        entityId: cardId,
      });
      return {
        card,
        publicToken,
      };
    });
    res.json({
      success: true,
      data: {
        card: serializeCard(result.card, result.publicToken),
        publicUrl: buildPublicUrl(result.publicToken),
      },
    });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

router.patch('/loyalty/cards/:cardId/status', requireOwner, async (req, res) => {
  try {
    const cardId = parseId(req.params.cardId, 'cardId');
    const isActive = Boolean(req.body?.isActive);
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.loyaltyCard.findUnique({ where: { id: cardId } });
      if (!before) throw validationError('Loyalty card not found', 404);
      const card = await tx.loyaltyCard.update({
        where: { id: cardId },
        data: { isActive },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      await recordLoyaltyAudit(tx, req, {
        action: isActive ? 'activate loyalty card' : 'deactivate loyalty card',
        after: serializeCard(card),
        before: serializeCard(before),
        entityId: cardId,
      });
      return card;
    });
    res.json({ success: true, data: serializeCard(result) });
  } catch (error) {
    await sendRouteError(req, res, error);
  }
});

module.exports = {
  loyaltyRouter: router,
  publicLoyaltyRouter: publicRouter,
};
