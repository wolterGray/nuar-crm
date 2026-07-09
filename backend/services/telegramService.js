// backend/services/telegramService.js
// Service for sending Telegram digest messages.
// Uses Telegram Bot API – token must be provided via TELEGRAM_BOT_TOKEN env var.

const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient();

const createDeliveryFailureNotification = async (prisma, deliveryId, recipient, channel, errorMessage, notificationEventId) => {
  try {
    let clientName = null;
    let clientId = null;

    if (notificationEventId) {
      const parentEvent = await prisma.notificationEvent.findUnique({
        where: { id: notificationEventId },
        select: { clientId: true, clientName: true },
      });
      if (parentEvent) {
        clientId = parentEvent.clientId;
        clientName = parentEvent.clientName;
      }
    }

    const channelName = channel === 'sms' ? 'SMS' : 'Telegram';
    await prisma.notificationEvent.upsert({
      where: { fingerprint: `delivery-failed:${channel}:${deliveryId}` },
      create: {
        fingerprint: `delivery-failed:${channel}:${deliveryId}`,
        source: 'delivery-worker',
        type: 'delivery_failed',
        entityType: 'notification_delivery',
        entityId: String(deliveryId),
        clientId,
        clientName,
        priority: 'high',
        score: 85,
        title: `Ошибка отправки ${channelName}`,
        message: `Для: ${recipient} · ${errorMessage}`,
        recommendedAction: 'contact_client',
        status: 'new',
      },
      update: {
        message: `Для: ${recipient} · ${errorMessage}`,
      },
    });
  } catch (err) {
    console.error('Failed to create delivery failure notification:', err);
  }
};

/**
 * Sends a message via Telegram Bot.
 * @param {Object} payload
 * @param {string|number} payload.chatId - Telegram chat ID to send the digest to.
 * @param {string} payload.text - Message text (MarkdownV2 or plain).
 * @returns {Promise<Object>} Result object indicating success or error.
 */
const telegramDigest = async (payload) => {
  const token = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }
  const { chatId, text } = payload || {};
  if (!chatId) {
    return { success: false, error: 'chatId is required' };
  }
  if (!text) {
    return { success: false, error: 'text is required' };
  }

  let delivery = null;
  try {
    delivery = await prisma.notificationDelivery.create({
      data: {
        channel: 'telegram',
        messageText: String(text),
        recipient: String(chatId),
        scheduledAt: new Date(),
        status: 'pending',
        templateKey: 'telegram-digest',
      },
    });
  } catch (error) {
    console.error('Telegram delivery log create failed:', error);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(payload?.parseMode ? {parse_mode: payload.parseMode} : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const errorMsg = data.description || `Telegram API error ${response.status}`;
      if (delivery) {
        await prisma.notificationDelivery.update({
          where: {id: delivery.id},
          data: {
            attempts: {increment: 1},
            errorMessage: errorMsg,
            status: 'failed',
          },
        });
        await createDeliveryFailureNotification(
          prisma,
          delivery.id,
          String(chatId),
          'telegram',
          errorMsg,
          payload?.notificationEventId
        );
      }
      return { success: false, error: errorMsg };
    }
    if (delivery) {
      await prisma.notificationDelivery.update({
        where: {id: delivery.id},
        data: {
          attempts: {increment: 1},
          errorMessage: null,
          providerMessageId: String(data.result.message_id),
          sentAt: new Date(),
          status: 'sent',
        },
      });
    }
    return {
      success: true,
      deliveryId: delivery?.id,
      messageId: data.result.message_id,
      chatId: data.result.chat.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Telegram request failed';
    if (delivery) {
      await prisma.notificationDelivery.update({
        where: {id: delivery.id},
        data: {
          attempts: {increment: 1},
          errorMessage: errorMsg,
          status: 'failed',
        },
      });
      await createDeliveryFailureNotification(
        prisma,
        delivery.id,
        String(chatId),
        'telegram',
        errorMsg,
        payload?.notificationEventId
      );
    }
    return { success: false, error: errorMsg };
  }
};

module.exports = { telegramDigest };
