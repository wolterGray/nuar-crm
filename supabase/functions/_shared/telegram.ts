const TELEGRAM_API_BASE = "https://api.telegram.org";

export const isTelegramConfigured = () =>
  Boolean(String(Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim());

export const isTelegramReady = (appSettings: Record<string, unknown> = {}) =>
  isTelegramConfigured() && Boolean(getTelegramChatId(appSettings));

export const getTelegramChatId = (appSettings: Record<string, unknown> = {}) => {
  const fromSettings = String(appSettings.telegramChatId ?? "").trim();
  const fromEnv = String(Deno.env.get("TELEGRAM_CHAT_ID") ?? "").trim();

  return fromSettings || fromEnv;
};

export const sendTelegramMessage = async ({
  chatId,
  message,
}: {
  chatId: string;
  message: string;
}) => {
  const token = String(Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();

  if (!token) {
    return {ok: false, error: "TELEGRAM_BOT_TOKEN is not configured"};
  }

  if (!chatId) {
    return {ok: false, error: "Telegram chat id is not configured"};
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        chat_id: chatId,
        disable_web_page_preview: true,
        text: message,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error:
          payload?.description ||
          payload?.error ||
          `Telegram API error (${response.status})`,
      };
    }

    return {
      ok: true,
      messageId: String(payload?.result?.message_id ?? ""),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram send failed",
    };
  }
};
