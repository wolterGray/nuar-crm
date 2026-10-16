const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {requireOwner} = require('../middleware/auth');
const {recordAuditLog, recordErrorEvent} = require('../services/loggingService');
const {
  getVapidConfiguration,
  isWebPushConfigured,
  sendPushToUser,
} = require('../services/webPushService');

const prisma = new PrismaClient();
const router = express.Router();
const testRequestTimes = new Map();
const TEST_RATE_LIMIT_MS = 30 * 1000;
const PREFERENCE_FIELDS = [
  'pushNewVisits',
  'pushVisitCancelled',
  'pushVisitRescheduled',
  'pushImportantTasks',
  'pushOverdueTasks',
];

const cleanString = (value) => String(value ?? '').trim();

const resolveAuthenticatedUser = async (req) => {
  const rawId = req.auth?.sub || req.auth?.id;
  const numericId = Number(rawId);
  const email = cleanString(req.auth?.email).toLowerCase();
  const user = Number.isInteger(numericId) && numericId > 0
    ? await prisma.user.findUnique({where: {id: numericId}})
    : email
      ? await prisma.user.findUnique({where: {email}})
      : null;

  if (!user || !user.isActive) {
    const error = new Error('Push requires an active database user');
    error.status = 409;
    throw error;
  }
  return user;
};

const parseSubscription = (body = {}) => {
  const subscription = body.subscription && typeof body.subscription === 'object'
    ? body.subscription
    : body;
  const endpoint = cleanString(subscription.endpoint);
  const p256dh = cleanString(subscription.keys?.p256dh || subscription.p256dh);
  const auth = cleanString(subscription.keys?.auth || subscription.auth);
  if (!endpoint || !p256dh || !auth) {
    const error = new Error('Invalid Push subscription');
    error.status = 422;
    throw error;
  }
  return {auth, endpoint, p256dh};
};

const handleError = async (req, res, error, source) => {
  const status = Number(error?.status) || 500;
  if (status >= 500) {
    await recordErrorEvent(prisma, {
      context: {path: req.originalUrl, userId: req.auth?.sub || req.auth?.id || null},
      error,
      message: error.message,
      source,
    }).catch(() => {});
  }
  res.status(status).json({success: false, error: error.message || 'Push request failed'});
};

router.get('/push/config', async (req, res) => {
  try {
    await resolveAuthenticatedUser(req);
    const config = getVapidConfiguration();
    res.json({
      success: true,
      data: {configured: isWebPushConfigured(), publicKey: config.publicKey || null},
    });
  } catch (error) {
    await handleError(req, res, error, 'push.config');
  }
});

router.get('/push/preferences', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const preferences = await prisma.user.findUnique({select: Object.fromEntries(PREFERENCE_FIELDS.map((field) => [field, true])), where: {id: user.id}});
    res.json({success: true, data: preferences});
  } catch (error) {
    await handleError(req, res, error, 'push.preferences.read');
  }
});

router.put('/push/preferences', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const data = {};
    for (const field of PREFERENCE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        if (typeof req.body[field] !== 'boolean') {
          const error = new Error(`${field} must be boolean`);
          error.status = 422;
          throw error;
        }
        data[field] = req.body[field];
      }
    }
    const preferences = await prisma.user.update({
      data,
      select: Object.fromEntries(PREFERENCE_FIELDS.map((field) => [field, true])),
      where: {id: user.id},
    });
    res.json({success: true, data: preferences});
  } catch (error) {
    await handleError(req, res, error, 'push.preferences.update');
  }
});

router.post('/push/subscription/status', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const endpoint = cleanString(req.body?.endpoint);
    const subscription = endpoint
      ? await prisma.pushSubscription.findFirst({where: {endpoint, isActive: true, userId: user.id}})
      : null;
    res.json({success: true, data: {active: Boolean(subscription), subscriptionId: subscription?.id || null}});
  } catch (error) {
    await handleError(req, res, error, 'push.status');
  }
});

router.post('/push/subscriptions', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const input = parseSubscription(req.body);
    const existing = await prisma.pushSubscription.findUnique({
      select: {userId: true},
      where: {endpoint: input.endpoint},
    });
    if (existing && existing.userId !== user.id) {
      const error = new Error('Push subscription belongs to another user');
      error.status = 409;
      throw error;
    }
    const subscription = await prisma.pushSubscription.upsert({
      create: {
        ...input,
        deviceName: cleanString(req.body?.deviceName) || null,
        platform: cleanString(req.body?.platform) || null,
        userAgent: cleanString(req.headers['user-agent']) || null,
        userId: user.id,
      },
      update: {
        auth: input.auth,
        deviceName: cleanString(req.body?.deviceName) || null,
        failureCount: 0,
        isActive: true,
        lastError: null,
        lastErrorAt: null,
        p256dh: input.p256dh,
        platform: cleanString(req.body?.platform) || null,
        userAgent: cleanString(req.headers['user-agent']) || null,
        userId: user.id,
      },
      where: {endpoint: input.endpoint},
    });
    await recordAuditLog(prisma, req, {
      action: 'register push subscription',
      after: {id: subscription.id, platform: subscription.platform, userId: user.id},
      before: null,
      entity: 'PushSubscription',
      entityId: subscription.id,
    });
    res.json({success: true, data: {active: true, subscriptionId: subscription.id}});
  } catch (error) {
    await handleError(req, res, error, 'push.subscribe');
  }
});

router.delete('/push/subscriptions', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const endpoint = cleanString(req.body?.endpoint);
    if (endpoint) {
      await prisma.pushSubscription.updateMany({
        data: {isActive: false, lastUsedAt: new Date()},
        where: {endpoint, userId: user.id},
      });
    }
    res.json({success: true, data: {active: false}});
  } catch (error) {
    await handleError(req, res, error, 'push.unsubscribe');
  }
});

router.post('/push/test', requireOwner, async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const now = Date.now();
    const lastRequestAt = testRequestTimes.get(user.id) || 0;
    if (now - lastRequestAt < TEST_RATE_LIMIT_MS) {
      return res.status(429).json({success: false, error: 'Подождите 30 секунд перед повторным тестом'});
    }
    testRequestTimes.set(user.id, now);
    const result = await sendPushToUser(prisma, user.id, {
      body: 'Тестовое уведомление успешно доставлено!',
      tag: `nuar-test-${now}`,
      title: 'Nuar CRM 🖤',
      ttl: 300,
      type: 'web-push-test',
      url: '/',
    });
    const success = result.sent > 0;
    const status = result.total === 0 ? 409 : success ? 200 : 502;
    res.status(status).json({
      success,
      data: result,
      error: result.total === 0
        ? 'Нет активных Push-подписок'
        : success
          ? undefined
          : 'Тестовое уведомление не доставлено',
    });
  } catch (error) {
    await handleError(req, res, error, 'push.test');
  }
});

module.exports = router;
