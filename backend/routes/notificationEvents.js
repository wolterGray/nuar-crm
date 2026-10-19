const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {recordAuditLog, recordErrorEvent} = require('../services/loggingService');
const {planNotificationDeliveries} = require('../services/notificationDeliveryPlanner');
const {
  generateSmartNotificationEvents,
  getNotificationCountsForUser,
  listNotificationEventsForUser,
  updateNotificationRecipient,
  upsertNotificationEvent,
} = require('../services/notificationEventsService');
const {requirePermission, PERMISSIONS} = require('../middleware/auth');
const {getHttpErrorResponse} = require('../utils/httpErrors');

const prisma = new PrismaClient();
const router = express.Router();

const resolveAuthenticatedUser = async (req) => {
  const numericId = Number(req.auth?.sub || req.auth?.id);
  const email = String(req.auth?.email ?? '').trim().toLowerCase();
  const user = Number.isInteger(numericId) && numericId > 0
    ? await prisma.user.findUnique({where: {id: numericId}})
    : email
      ? await prisma.user.findUnique({where: {email}})
      : null;
  if (!user?.isActive) {
    const error = new Error('Notifications require an active database user');
    error.status = 409;
    throw error;
  }
  return user;
};

router.get('/notification-events', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const events = await listNotificationEventsForUser(prisma, user.id, {
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status || 'active',
    });
    res.json({success: true, data: events});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notification-events/counts', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const counts = await getNotificationCountsForUser(prisma, user.id);
    res.json({success: true, data: counts});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notification-events', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
  try {
    const event = await upsertNotificationEvent(prisma, req.body);
    await recordAuditLog(prisma, req, {
      action: 'upsert notification event',
      after: event,
      before: null,
      entity: 'NotificationEvent',
      entityId: event.id,
    });
    res.json({success: true, data: event});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    await recordErrorEvent(prisma, {
      context: {body: req.body},
      error,
      message: error.message,
      source: 'notification-events',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notification-events/generate', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
  try {
    const result = await generateSmartNotificationEvents(prisma);
    await recordAuditLog(prisma, req, {
      action: 'generate notification events',
      after: {count: result.count},
      before: null,
      entity: 'NotificationEvent',
      entityId: 'smart-generator',
    });
    res.json({success: true, data: result});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    await recordErrorEvent(prisma, {
      context: {body: req.body},
      error,
      message: error.message,
      source: 'notification-events',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notification-events/plan-delivery', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
  try {
    const commit = req.body?.commit === true;
    const result = await planNotificationDeliveries(prisma, {
      commit,
      limit: req.body?.limit,
    });
    await recordAuditLog(prisma, req, {
      action: commit ? 'queue notification deliveries' : 'plan notification deliveries',
      after: {
        count: result.count,
        queuedCount: result.queuedCount,
        quietHoursActive: result.quietHoursActive,
      },
      before: null,
      entity: 'NotificationEvent',
      entityId: 'delivery-planner',
    });
    res.json({success: true, data: result});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    await recordErrorEvent(prisma, {
      context: {body: req.body},
      error,
      message: error.message,
      source: 'notification-delivery-planner',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.patch('/notification-events/:id', async (req, res) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    const before = await prisma.notificationRecipient.findUnique({
      where: {notificationEventId_userId: {notificationEventId: Number(req.params.id), userId: user.id}},
    });
    const event = await updateNotificationRecipient(prisma, user.id, req.params.id, req.body);
    await recordAuditLog(prisma, req, {
      action: 'update notification event',
      after: event,
      before,
      entity: 'NotificationRecipient',
      entityId: `${event.id}:${user.id}`,
    });
    res.json({success: true, data: event});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    await recordErrorEvent(prisma, {
      context: {body: req.body, id: req.params.id},
      error,
      message: error.message,
      source: 'notification-events',
    });
    res.status(response.status).json({success: false, error: response.message});
  }
});

module.exports = router;
