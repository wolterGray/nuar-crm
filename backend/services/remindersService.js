// backend/services/remindersService.js
// Service for handling SMS reminders.
// Accepts an array of reminder objects with `phone`, `message`, and optional `sendAt` timestamp.
// Future reminders are stored in NotificationDelivery, so PM2 restarts do not lose them.

const { queueSmsDelivery, sendBulkSms } = require('./smsService');

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
    if (sendTime <= now) {
      try {
        const result = await sendBulkSms({ recipients: [{ phone, message }], message: '' });
        if (result.sent && result.sent.length) {
          sent.push({
            deliveryId: result.sent[0].deliveryId,
            message,
            messageId: result.sent[0].providerMessageId,
            phone,
          });
        } else {
          failed.push({ phone, message, error: result.failed?.[0]?.error || 'unknown' });
        }
      } catch (e) {
        failed.push({ phone, message, error: e instanceof Error ? e.message : 'send error' });
      }
    } else {
      try {
        const delivery = await queueSmsDelivery({
          message,
          phone,
          scheduledAt: new Date(sendTime),
        });
        scheduled.push({
          deliveryId: delivery.id,
          phone: delivery.recipient,
          message,
          sendAt: new Date(sendTime).toISOString(),
        });
      } catch (e) {
        failed.push({ phone, message, error: e instanceof Error ? e.message : 'schedule error' });
      }
    }
  }

  return { success: true, scheduled, sent, failed };
};

module.exports = { smsReminders };
