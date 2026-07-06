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

const firstNonEmpty = (...values) =>
  values.map((value) => String(value ?? '').trim()).find(Boolean) || '';

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
  if (payload?.action === 'owner-notify-status') {
    const settings = await prisma.systemState
      .findUnique({where: {key: 'appSettings'}})
      .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
      .catch(() => ({}));
    const telegramChatId = firstNonEmpty(settings.telegramChatId, process.env.TELEGRAM_CHAT_ID);
    const ownerPhone = firstNonEmpty(settings.ownerNotifyPhone, process.env.OWNER_NOTIFY_PHONE);

    return res.json({
      success: true,
      ownerPhone,
      siteBookingNotifyTelegramEnabled: settings.siteBookingNotifyTelegramEnabled !== false,
      siteBookingNotifyWhatsappEnabled: settings.siteBookingNotifyWhatsappEnabled !== false,
      smsConfigured: Boolean(process.env.SMSAPI_TOKEN),
      telegramChatId,
      telegramChatIdConfigured: Boolean(telegramChatId),
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && telegramChatId),
      telegramTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    });
  }

  if (payload?.action === 'owner-notify-test') {
    const settings = await prisma.systemState
      .findUnique({where: {key: 'appSettings'}})
      .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
      .catch(() => ({}));
    const chatId = firstNonEmpty(settings.telegramChatId, process.env.TELEGRAM_CHAT_ID);
    const telegram = chatId
      ? await telegramDigest({chatId, text: 'NUAR CRM test'})
      : {success: false, error: 'telegramChatId is required'};

    await auditFunctionCall(req, 'test owner notification', {
      result: summarizeResult(telegram),
      telegramChatIdPresent: Boolean(chatId),
    });

    return res.json({
      success: telegram.success,
      results: {
        telegram: {
          ok: telegram.success === true,
          error: telegram.error ?? '',
        },
        whatsapp: {
          ok: false,
          error: '',
        },
      },
    });
  }

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
