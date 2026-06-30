// backend/services/smsService.js
// Service for sending bulk SMS using SMSAPI.
// This module is used by the /functions/bulk-sms endpoint.

const MAX_RECIPIENTS = 100;

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
 * Returns an object similar to the original Supabase function result.
 */
const sendSms = async ({ to, message, from }) => {
  const token = String(process.env.SMSAPI_TOKEN ?? '').trim();
  if (!token) {
    return { ok: false, error: 'SMSAPI_TOKEN is not configured' };
  }
  const sender = from || process.env.SMSAPI_SENDER || 'NUAR';
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
    const phone = normalizePhone(item.phone);
    const txt = String(item.message ?? message ?? '').trim();
    const clientId = String(item.clientId ?? '').trim();
    const clientName = String(item.clientName ?? '').trim();
    if (!phone || !txt) {
      failed.push({ clientId, clientName, phone, error: 'phone or message missing', status: 'failed' });
      continue;
    }
    const result = await sendSms({ to: phone, message: txt });
    const entry = {
      clientId,
      clientName,
      phone,
      message: txt,
      providerMessageId: result.messageId ?? '',
      status: result.ok ? 'sent' : 'failed',
      error: result.error ?? '',
    };
    if (result.ok) sent.push(entry); else failed.push(entry);
    // pause to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { sent, failed, sentCount: sent.length, failedCount: failed.length };
};

module.exports = { sendBulkSms, normalizePhone, MAX_RECIPIENTS };
