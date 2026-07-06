const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { sendBulkSms } = require('../services/smsService');
const { telegramDigest } = require('../services/telegramService');
const { smsReminders } = require('../services/remindersService');
const { ownerNotify } = require('../services/ownerNotifyService');
const { reviewRequests } = require('../services/reviewRequestsService');
const { booksySync } = require('../services/booksySyncService');

const prisma = new PrismaClient();

const countItems = (value) => (Array.isArray(value) ? value.length : 0);

const functionValidationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const getFunctionErrorResponse = (error) => {
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return {message: error.message || 'Invalid request', status: error.status};
  }

  if (
    /required|missing|too many recipients|phone or message missing/i.test(String(error?.message ?? ''))
  ) {
    return {message: error.message, status: 422};
  }

  return {message: 'Function request failed', status: 500};
};

const summarizeResult = (result = {}) => ({
  deliveryId: result.deliveryId ?? null,
  failedCount: result.failedCount ?? countItems(result.failed),
  messageId: result.messageId ?? null,
  scheduledCount: countItems(result.scheduled),
  sentCount: result.sentCount ?? countItems(result.sent),
  success: result.success ?? true,
});

const auditFunctionCall = (req, action, metadata) =>
  recordAuditLog(prisma, req, {
    action,
    after: metadata,
    before: null,
    entity: 'Function',
    entityId: req.path,
  });

// Bulk SMS
router.post('/bulk-sms', requireOwner, async (req, res) => {
  const { action, recipients, message, testNumber } = req.body;

  try {
    if (action === 'test') {
      if (!testNumber) {
        throw functionValidationError('testNumber is required');
      }
      const result = await sendBulkSms({ recipients: [testNumber], message });
      await auditFunctionCall(req, 'send bulk sms test', {
        action,
        hasMessage: Boolean(String(message ?? '').trim()),
        result: summarizeResult(result),
        testNumberPresent: Boolean(testNumber),
      });
      return res.json({ success: true, message: 'Test SMS sent', result });
    }

    if (action === 'send') {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw functionValidationError('recipients array is required');
      }
      const result = await sendBulkSms({ recipients, message });
      await auditFunctionCall(req, 'send bulk sms', {
        action,
        hasMessage: Boolean(String(message ?? '').trim()),
        recipientCount: countItems(recipients),
        result: summarizeResult(result),
      });
      return res.json({ success: true, message: 'Bulk SMS process initiated', result });
    }

    if (action === 'status') {
      return res.json({ success: true, status: 'idle' });
    }

    throw Object.assign(new Error('Invalid action'), {status: 400});
  } catch (error) {
    const response = getFunctionErrorResponse(error);
    console.error('Bulk SMS error:', error);
    await recordErrorEvent(prisma, {
      context: {
        action,
        path: req.originalUrl,
        recipientCount: countItems(recipients),
      },
      error,
      message: error.message,
      source: 'functions',
    });
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// Telegram Digest (stub)
router.post('/telegram-digest', requireOwner, async (req, res) => {
  const payload = req.body;
  const result = await telegramDigest(payload);
  await auditFunctionCall(req, 'send telegram digest', {
    chatIdPresent: Boolean(payload?.chatId),
    hasText: Boolean(String(payload?.text ?? '').trim()),
    result: summarizeResult(result),
  });
  res.json(result);
});

// SMS Reminders (stub)
router.post('/sms-reminders', requireOwner, async (req, res) => {
  const payload = req.body;
  const result = await smsReminders(payload);
  await auditFunctionCall(req, 'send sms reminders', {
    reminderCount: countItems(payload?.reminders),
    result: summarizeResult(result),
  });
  res.json(result);
});

// Owner Notify (stub)
router.post('/owner-notify', requireOwner, async (req, res) => {
  const payload = req.body;
  const result = await ownerNotify(payload);
  await auditFunctionCall(req, 'send owner notification', {
    hasHtml: Boolean(String(payload?.html ?? '').trim()),
    hasSubject: Boolean(String(payload?.subject ?? '').trim()),
    hasText: Boolean(String(payload?.text ?? '').trim()),
    result: summarizeResult(result),
  });
  res.json(result);
});

// Review Requests (stub)
router.post('/review-requests', requireOwner, async (req, res) => {
  const payload = req.body;
  const result = await reviewRequests(payload);
  await auditFunctionCall(req, 'send review request', {
    hasHtml: Boolean(String(payload?.html ?? '').trim()),
    hasReviewerEmail: Boolean(String(payload?.reviewerEmail ?? '').trim()),
    hasSubject: Boolean(String(payload?.subject ?? '').trim()),
    hasText: Boolean(String(payload?.text ?? '').trim()),
    result: summarizeResult(result),
  });
  res.json(result);
});

// Booksy Sync (stub)
router.post('/booksy-sync', requireOwner, async (req, res) => {
  const payload = req.body;
  const result = await booksySync(payload);
  await auditFunctionCall(req, 'run booksy sync', {
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    result: summarizeResult(result),
  });
  res.json(result);
});

module.exports = router;
