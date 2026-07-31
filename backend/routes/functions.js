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

const loadAppSettings = () =>
  prisma.systemState
    .findUnique({where: {key: 'appSettings'}})
    .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
    .catch(() => ({}));

const isSmsEnabled = (settings = {}) => settings.smsEnabled === true;
const isTelegramEnabled = (settings = {}) => settings.telegramEnabled === true;

const skippedIntegrationResponse = ({configured = false, enabled = false, reason}) => ({
  success: true,
  configured,
  enabled,
  failed: [],
  reason,
  scheduled: [],
  sent: [],
  skipped: true,
});

// Bulk SMS
router.post('/bulk-sms', requireOwner, async (req, res) => {
  const { action, recipients, message, testNumber } = req.body;

  try {
    const settings = await loadAppSettings();
    if ((action === 'test' || action === 'send') && !isSmsEnabled(settings)) {
      return res.json(skippedIntegrationResponse({
        configured: Boolean(process.env.SMSAPI_TOKEN),
        reason: 'sms_disabled',
      }));
    }

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
      const dueCount = await prisma.notificationDelivery.count({
        where: {
          attempts: {lt: 3},
          channel: 'sms',
          scheduledAt: {lte: new Date()},
          status: {in: ['pending', 'retrying']},
        },
      });

      return res.json({
        success: true,
        configured: Boolean(process.env.SMSAPI_TOKEN),
        dueCount: isSmsEnabled(settings) ? dueCount : 0,
        enabled: isSmsEnabled(settings),
        maxRecipients: 100,
        status: 'idle',
      });
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

// Telegram Digest
router.post('/telegram-digest', requireOwner, async (req, res) => {
  const payload = req.body;
  if (payload?.action === 'status') {
    const settings = await loadAppSettings();
    const telegramEnabled = isTelegramEnabled(settings);
    const telegramChatId = firstNonEmpty(
      settings.telegramChatId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_OWNER_CHAT_ID,
    );

    return res.json({
      success: true,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && telegramChatId),
      enabled: telegramEnabled && settings.telegramDigestEnabled === true,
      lastRunAt: settings.telegramDigestLastRunAt || null,
      previewMessage: '',
      telegramChatIdConfigured: Boolean(telegramChatId),
      telegramTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    });
  }

  if (payload?.action === 'owner-notify-status') {
    const settings = await loadAppSettings();
    const telegramEnabled = isTelegramEnabled(settings);
    const telegramChatId = firstNonEmpty(
      settings.telegramChatId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_OWNER_CHAT_ID,
    );
    const ownerPhone = firstNonEmpty(settings.ownerNotifyPhone, process.env.OWNER_NOTIFY_PHONE);

    return res.json({
      success: true,
      ownerPhone,
      siteBookingNotifyTelegramEnabled:
        telegramEnabled && settings.siteBookingNotifyTelegramEnabled === true,
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
    const settings = await loadAppSettings();
    const telegramEnabled =
      isTelegramEnabled(settings) && settings.siteBookingNotifyTelegramEnabled === true;
    const whatsappEnabled = settings.siteBookingNotifyWhatsappEnabled !== false;
    const chatId = firstNonEmpty(
      settings.telegramChatId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_OWNER_CHAT_ID,
    );
    const telegram = telegramEnabled && chatId
      ? await telegramDigest({chatId, purpose: 'site-booking', text: 'NUAR CRM test'})
      : {
          success: false,
          error: telegramEnabled ? 'telegramChatId is required' : 'telegram disabled in settings',
          skipped: !telegramEnabled,
        };

    await auditFunctionCall(req, 'test owner notification', {
      result: summarizeResult(telegram),
      telegramChatIdPresent: Boolean(chatId),
    });

    return res.json({
      success: telegram.success || telegram.skipped === true,
      results: {
        telegram: {
          ok: telegram.success === true || telegram.skipped === true,
          error: telegram.error ?? '',
          skipped: telegram.skipped === true,
        },
        whatsapp: {
          ok: !whatsappEnabled,
          error: '',
          skipped: !whatsappEnabled,
        },
      },
    });
  }

  const digestSettings = await loadAppSettings();
  const digestDisabled =
    !isTelegramEnabled(digestSettings) || digestSettings.telegramDigestEnabled !== true;

  if (payload?.action === 'test') {
    if (digestDisabled) {
      return res.json({
        success: true,
        configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        enabled: false,
        reason: 'telegram_disabled',
        sent: false,
        skipped: true,
      });
    }

    const chatId = firstNonEmpty(
      payload.chatId,
      digestSettings.telegramChatId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_OWNER_CHAT_ID,
    );
    const result = await telegramDigest({
      chatId,
      text: payload.message || 'NUAR CRM test',
    });

    await auditFunctionCall(req, 'send telegram test', {
      chatIdPresent: Boolean(chatId),
      result: summarizeResult(result),
    });

    return res.json(result);
  }

  if (digestDisabled) {
    return res.json({
      success: true,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      enabled: false,
      reason: 'telegram_disabled',
      sent: false,
      skipped: true,
    });
  }

  const result = await telegramDigest({
    ...payload,
    chatId: firstNonEmpty(
      payload?.chatId,
      digestSettings.telegramChatId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_OWNER_CHAT_ID,
    ),
  });
  await auditFunctionCall(req, 'send telegram digest', {
    chatIdPresent: Boolean(payload?.chatId),
    hasText: Boolean(String(payload?.text ?? '').trim()),
    result: summarizeResult(result),
  });
  res.json(result);
});

// SMS Reminders
router.post('/sms-reminders', requireOwner, async (req, res) => {
  const payload = req.body;
  const settings = await loadAppSettings();
  const smsEnabled = isSmsEnabled(settings);
  const action = payload?.action;
  if (payload?.action === 'status') {
    const dueCount = await prisma.notificationDelivery.count({
      where: {
        attempts: {lt: 3},
        channel: 'sms',
        scheduledAt: {lte: new Date()},
        status: {in: ['pending', 'retrying']},
      },
    });

    return res.json({
      success: true,
      configured: Boolean(process.env.SMSAPI_TOKEN),
      dueCount: smsEnabled && settings.smsRemindersEnabled === true ? dueCount : 0,
      enabled: smsEnabled && settings.smsRemindersEnabled === true,
      lastRunAt: null,
      recentLog: [],
      skippedCount: 0,
    });
  }

  if (!smsEnabled) {
    return res.json(skippedIntegrationResponse({
      configured: Boolean(process.env.SMSAPI_TOKEN),
      reason: 'sms_disabled',
    }));
  }

  if (
    action === 'test' ||
    action === 'review-requests-test' ||
    action === 'inactive-follow-up-test'
  ) {
    const result = await smsReminders({
      reminders: [
        {
          message: payload.message,
          phone: payload.phone,
        },
      ],
    });
    await auditFunctionCall(req, 'send sms reminder test', {
      result: summarizeResult(result),
      testPhonePresent: Boolean(payload.phone),
    });
    return res.json(result);
  }

  const disabledReason =
    action === 'review-requests' && settings.reviewRequestsEnabled !== true
      ? 'review_requests_disabled'
      : action === 'inactive-follow-up' && settings.inactiveFollowUpEnabled !== true
        ? 'inactive_follow_up_disabled'
        : (!action || action === 'process') && settings.smsRemindersEnabled !== true
          ? 'sms_reminders_disabled'
          : '';

  if (disabledReason) {
    return res.json(skippedIntegrationResponse({
      configured: Boolean(process.env.SMSAPI_TOKEN),
      reason: disabledReason,
    }));
  }

  const result = await smsReminders(payload);
  await auditFunctionCall(req, 'send sms reminders', {
    reminderCount: countItems(payload?.reminders),
    result: summarizeResult(result),
  });
  res.json(result);
});

// Owner email notification
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

// Review Requests
router.post('/review-requests', requireOwner, async (req, res) => {
  const payload = req.body;
  const settings = await loadAppSettings();
  const smsEnabled = isSmsEnabled(settings);
  if (!smsEnabled || settings.reviewRequestsEnabled !== true) {
    return res.json(skippedIntegrationResponse({
      configured: Boolean(process.env.SMSAPI_TOKEN),
      reason: smsEnabled ? 'review_requests_disabled' : 'sms_disabled',
    }));
  }

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

// Booksy Gmail Sync compatibility endpoint
router.post('/booksy-sync', requireOwner, async (req, res) => {
  const payload = req.body;
  const settings = await loadAppSettings();
  if (settings.gmailBooksySyncEnabled !== true) {
    return res.json({
      success: true,
      enabled: false,
      reason: 'gmail_booksy_sync_disabled',
      skipped: true,
    });
  }

  const result = await booksySync(payload);
  await auditFunctionCall(req, 'run booksy sync', {
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    result: summarizeResult(result),
  });
  res.json(result);
});

module.exports = router;
