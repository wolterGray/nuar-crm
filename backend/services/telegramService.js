// backend/services/telegramService.js
// Service for sending Telegram digest messages.
// Uses Telegram Bot API – token must be provided via TELEGRAM_BOT_TOKEN env var.

const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient();

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
      if (delivery) {
        await prisma.notificationDelivery.update({
          where: {id: delivery.id},
          data: {
            attempts: {increment: 1},
            errorMessage: data.description || `Telegram API error ${response.status}`,
            status: 'failed',
          },
        });
      }
      return { success: false, error: data.description || `Telegram API error ${response.status}` };
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
    if (delivery) {
      await prisma.notificationDelivery.update({
        where: {id: delivery.id},
        data: {
          attempts: {increment: 1},
          errorMessage: err instanceof Error ? err.message : 'Telegram request failed',
          status: 'failed',
        },
      });
    }
    return { success: false, error: err instanceof Error ? err.message : 'Telegram request failed' };
  }
};

module.exports = { telegramDigest };
