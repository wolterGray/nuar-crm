// backend/services/telegramService.js
// Service for sending Telegram digest messages.
// Uses Telegram Bot API – token must be provided via TELEGRAM_BOT_TOKEN env var.

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
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { success: false, error: data.description || `Telegram API error ${response.status}` };
    }
    return { success: true, messageId: data.result.message_id, chatId: data.result.chat.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Telegram request failed' };
  }
};

module.exports = { telegramDigest };
