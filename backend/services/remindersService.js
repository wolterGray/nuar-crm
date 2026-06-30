// backend/services/remindersService.js
// Service for handling SMS reminders.
// Accepts an array of reminder objects with `phone`, `message`, and optional `sendAt` timestamp.
// If `sendAt` is in the future, the reminder is scheduled via setTimeout (in‑process). 
// For production you would move scheduling to a job queue (e.g., Bull, Agenda).

const { sendBulkSms } = require('./smsService');

/**
 * Sends or schedules SMS reminders.
 * @param {Object} payload
 * @param {Array<{phone:string, message:string, sendAt?:string|number}>} payload.reminders
 * @returns {Promise<Object>} Result with `scheduled` and `sent` arrays.
 */
const smsReminders = async (payload) => {
  const { reminders = [] } = payload || {};
  if (!Array.isArray(reminders) || reminders.length === 0) {
    return { success: false, error: 'reminders array is required' };
  }

  const now = Date.now();
  const scheduled = [];
  const sent = [];
  const failed = [];

  for (const item of reminders) {
    const { phone, message, sendAt } = item;
    const sendTime = sendAt ? new Date(sendAt).getTime() : now;
    const task = async () => {
      try {
        const result = await sendBulkSms({ recipients: [{ phone, message }], message: '' });
        if (result.sent && result.sent.length) {
          sent.push({ phone, message, messageId: result.sent[0].providerMessageId });
        } else {
          failed.push({ phone, message, error: result.failed?.[0]?.error || 'unknown' });
        }
      } catch (e) {
        failed.push({ phone, message, error: e instanceof Error ? e.message : 'send error' });
      }
    };

    if (sendTime <= now) {
      await task();
    } else {
      const delay = sendTime - now;
      scheduled.push({ phone, message, sendAt: new Date(sendTime).toISOString() });
      setTimeout(task, delay);
    }
  }

  return { success: true, scheduled, sent, failed };
};

module.exports = { smsReminders };
