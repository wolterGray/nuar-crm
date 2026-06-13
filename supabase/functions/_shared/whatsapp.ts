import {normalizeNotifyPhone} from "./phone.ts";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v21.0";

export const isWhatsappConfigured = () =>
  Boolean(
    String(Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "").trim() &&
      String(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "").trim(),
  );

export const getOwnerNotifyPhone = (appSettings: Record<string, unknown> = {}) => {
  const fromSettings = String(appSettings.ownerNotifyPhone ?? "").trim();
  const fromEnv = String(Deno.env.get("OWNER_NOTIFY_PHONE") ?? "").trim();

  return normalizeNotifyPhone(fromSettings || fromEnv);
};

export const sendWhatsappMessage = async ({
  message,
  to,
}: {
  message: string;
  to: string;
}) => {
  const token = String(Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "").trim();
  const phoneNumberId = String(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "").trim();
  const normalizedTo = normalizeNotifyPhone(to);

  if (!token || !phoneNumberId) {
    return {ok: false, error: "WhatsApp API is not configured"};
  }

  if (!normalizedTo) {
    return {ok: false, error: "Owner phone is not configured"};
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedTo,
          type: "text",
          text: {
            body: message,
            preview_url: false,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error:
          String(
            (payload as {error?: {message?: string}})?.error?.message ??
              payload?.error ??
              "",
          ).trim() || `WhatsApp API error (${response.status})`,
      };
    }

    return {
      ok: true,
      messageId: String(
        (payload as {messages?: Array<{id?: string}>})?.messages?.[0]?.id ?? "",
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WhatsApp send failed",
    };
  }
};
