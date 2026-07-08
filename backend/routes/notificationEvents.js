const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {recordAuditLog, recordErrorEvent} = require('../services/loggingService');
const {planNotificationDeliveries} = require('../services/notificationDeliveryPlanner');
const {
  generateSmartNotificationEvents,
  listNotificationEvents,
  updateNotificationEvent,
  upsertNotificationEvent,
} = require('../services/notificationEventsService');
const {getHttpErrorResponse} = require('../utils/httpErrors');

const prisma = new PrismaClient();
const router = express.Router();

router.get('/notification-events', async (req, res) => {
  try {
    const events = await listNotificationEvents(prisma, {
      limit: req.query.limit,
      status: req.query.status || 'active',
    });
    res.json({success: true, data: events});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notification-events', async (req, res) => {
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

router.post('/notification-events/generate', async (req, res) => {
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

router.post('/notification-events/plan-delivery', async (req, res) => {
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
    const before = await prisma.notificationEvent.findUnique({
      where: {id: Number(req.params.id)},
    });
    const event = await updateNotificationEvent(prisma, req.params.id, req.body);
    await recordAuditLog(prisma, req, {
      action: 'update notification event',
      after: event,
      before,
      entity: 'NotificationEvent',
      entityId: event.id,
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
