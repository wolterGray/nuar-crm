export type SmsSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  providerResponse?: unknown;
};

export const isSmsConfigured = () =>
  Boolean(String(Deno.env.get("SMSAPI_TOKEN") ?? "").trim());

export const sendSms = async ({
  to,
  message,
  from,
}: {
  to: string;
  message: string;
  from?: string;
}): Promise<SmsSendResult> => {
  const token = String(Deno.env.get("SMSAPI_TOKEN") ?? "").trim();

  if (!token) {
    return {ok: false, error: "SMSAPI_TOKEN is not configured"};
  }

  const sender = from || Deno.env.get("SMSAPI_SENDER") || "NUAR";
  const params = new URLSearchParams({
    to,
    message,
    from: sender,
    format: "json",
    encoding: "utf-8",
  });

  try {
    const response = await fetch(`https://api.smsapi.pl/sms.do?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const raw = await response.text();
    let parsed: Record<string, unknown> = {};

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {raw};
    }

    if (!response.ok) {
      return {
        ok: false,
        error:
          String(parsed.message ?? parsed.error ?? raw).trim() ||
          `SMS API error ${response.status}`,
        providerResponse: parsed,
      };
    }

    const messageId =
      String(
        (parsed as {list?: Array<{id?: string}>}).list?.[0]?.id ??
          (parsed as {id?: string}).id ??
          "",
      ).trim() || undefined;

    return {
      ok: true,
      messageId,
      providerResponse: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SMS send failed",
    };
  }
};
