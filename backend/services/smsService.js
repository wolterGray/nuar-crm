// backend/services/smsService.js
// Service for sending bulk SMS using SMSAPI.
// This module is used by the /functions/bulk-sms endpoint.

const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient();
const MAX_RECIPIENTS = 100;
const MAX_DELIVERY_ATTEMPTS = 3;

// Normalizes Polish phone numbers to E.164 format without '+' (e.g., 48xxxxxxxxx)
const normalizePhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('48') && digits.length === 11) return digits;
  if (digits.length === 9) return `48${digits}`;
  // fallback: keep digits if length >= 9
  return digits.length >= 9 ? digits : '';
};

/**
 * Low‑level SMS sender using the SMSAPI token from environment.
 * Returns a normalized provider result for backend routes and workers.
 */
const sendSms = async ({ to, message, from }) => {
  const token = String(process.env.SMSAPI_TOKEN ?? '').trim();
  if (!token) {
    return { ok: false, error: 'SMSAPI_TOKEN is not configured' };
  }
  const sender = from || process.env.SMSAPI_SENDER || process.env.SMSAPI_FROM || 'NUAR';
  const params = new URLSearchParams({
    to,
    message,
    from: sender,
    format: 'json',
    encoding: 'utf-8',
  });
  try {
    const response = await fetch(`https://api.smsapi.pl/sms.do?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await response.text();
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
    if (!response.ok) {
      return {
        ok: false,
        error: String(parsed.message ?? parsed.error ?? raw).trim() || `SMS API error ${response.status}`,
        providerResponse: parsed,
      };
    }
    const messageId = String((parsed.list?.[0]?.id ?? parsed.id ?? '').trim()) || undefined;
    return { ok: true, messageId, providerResponse: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'SMS send failed' };
  }
};

const getRecipientPhone = (item) =>
  typeof item === 'string' ? item : item?.phone;

const getRecipientMessage = (item, fallbackMessage) =>
  typeof item === 'string' ? fallbackMessage : item?.message ?? fallbackMessage;

const queueSmsDelivery = async ({
  message,
  phone,
  scheduledAt = null,
  status = 'pending',
  templateKey = null,
}) => {
  const normalizedPhone = normalizePhone(phone);
  const text = String(message ?? '').trim();

  if (!normalizedPhone || !text) {
    throw new Error('phone or message missing');
  }

  return prisma.notificationDelivery.create({
    data: {
      channel: 'sms',
      messageText: text,
      recipient: normalizedPhone,
      scheduledAt,
      status,
      templateKey,
    },
  });
};

const markDeliverySent = (delivery, result) =>
  prisma.notificationDelivery.update({
    where: {id: delivery.id},
    data: {
      attempts: {increment: 1},
      errorMessage: null,
      providerMessageId: result.messageId ?? delivery.providerMessageId,
      sentAt: new Date(),
      status: 'sent',
    },
  });

const markDeliveryFailed = (delivery, errorMessage, retrying = false) =>
  prisma.notificationDelivery.update({
    where: {id: delivery.id},
    data: {
      attempts: {increment: 1},
      errorMessage,
      status: retrying ? 'retrying' : 'failed',
    },
  });

const sendQueuedSmsDelivery = async (delivery) => {
  const result = await sendSms({
    message: delivery.messageText,
    to: delivery.recipient,
  });

  if (result.ok) {
    await markDeliverySent(delivery, result);
    return {
      deliveryId: delivery.id,
      phone: delivery.recipient,
      providerMessageId: result.messageId ?? '',
      status: 'sent',
    };
  }

  const nextAttempts = Number(delivery.attempts || 0) + 1;
  await markDeliveryFailed(
    delivery,
    result.error || 'SMS send failed',
    nextAttempts < MAX_DELIVERY_ATTEMPTS,
  );

  return {
    deliveryId: delivery.id,
    error: result.error || 'SMS send failed',
    phone: delivery.recipient,
    status: nextAttempts < MAX_DELIVERY_ATTEMPTS ? 'retrying' : 'failed',
  };
};

/**
 * Sends bulk SMS messages.
 * @param {Object} params
 * @param {Array<{phone:string, message?:string, clientId?:string, clientName?:string}>} params.recipients - list of recipients.
 * @param {string} params.message - default message to use when recipient.item.message is omitted.
 * @returns {Promise<Object>} Result containing sent and failed arrays.
 */
const sendBulkSms = async ({ recipients = [], message = '' }) => {
  if (!process.env.SMSAPI_TOKEN) {
    throw new Error('SMSAPI_TOKEN is not configured');
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('recipients array is required');
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new Error(`Too many recipients – maximum is ${MAX_RECIPIENTS}`);
  }

  const sent = [];
  const failed = [];

  for (const item of recipients) {
    const phone = normalizePhone(getRecipientPhone(item));
    const txt = String(getRecipientMessage(item, message) ?? '').trim();
    const clientId = typeof item === 'string' ? '' : String(item.clientId ?? '').trim();
    const clientName = typeof item === 'string' ? '' : String(item.clientName ?? '').trim();
    if (!phone || !txt) {
      failed.push({ clientId, clientName, phone, error: 'phone or message missing', status: 'failed' });
      continue;
    }

    let delivery;
    try {
      delivery = await queueSmsDelivery({
        message: txt,
        phone,
        scheduledAt: new Date(),
      });
    } catch (error) {
      failed.push({
        clientId,
        clientName,
        phone,
        error: error instanceof Error ? error.message : 'delivery log failed',
        status: 'failed',
      });
      continue;
    }

    const result = await sendQueuedSmsDelivery(delivery);
    const entry = {
      clientId,
      clientName,
      deliveryId: delivery.id,
      phone,
      message: txt,
      providerMessageId: result.providerMessageId ?? '',
      status: result.status,
      error: result.error ?? '',
    };
    if (result.status === 'sent') sent.push(entry); else failed.push(entry);
    // pause to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { sent, failed, sentCount: sent.length, failedCount: failed.length };
};

const processDueSmsDeliveries = async ({limit = 50} = {}) => {
  const dueDeliveries = await prisma.notificationDelivery.findMany({
    where: {
      attempts: {lt: MAX_DELIVERY_ATTEMPTS},
      channel: 'sms',
      scheduledAt: {lte: new Date()},
      status: {in: ['pending', 'retrying']},
    },
    orderBy: [{scheduledAt: 'asc'}, {createdAt: 'asc'}],
    take: limit,
  });

  const results = [];
  for (const delivery of dueDeliveries) {
    results.push(await sendQueuedSmsDelivery(delivery));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return {
    processed: results.length,
    results,
  };
};

module.exports = {
  MAX_RECIPIENTS,
  normalizePhone,
  processDueSmsDeliveries,
  queueSmsDelivery,
  sendBulkSms,
};
