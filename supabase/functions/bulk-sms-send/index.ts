import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {isSmsConfigured, sendSms} from "../_shared/smsapi.ts";

const MAX_RECIPIENTS = 100;

const normalizePhone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("48") && digits.length === 11) {
    return digits;
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  return digits.length >= 9 ? digits : "";
};

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  if (request.method !== "POST") {
    return jsonResponse({error: "Method not allowed"}, 405);
  }

  try {
    await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "status");

    if (action === "status") {
      return jsonResponse({
        configured: isSmsConfigured(),
        maxRecipients: MAX_RECIPIENTS,
      });
    }

    if (action === "test") {
      const phone = normalizePhone(body.phone);
      const message = String(body.message ?? "").trim();

      if (!phone) {
        return jsonResponse({error: "phone is required"}, 400);
      }

      if (!message) {
        return jsonResponse({error: "message is required"}, 400);
      }

      const result = await sendSms({to: phone, message});

      if (!result.ok) {
        return jsonResponse({error: result.error ?? "SMS send failed"}, 500);
      }

      return jsonResponse({ok: true, messageId: result.messageId ?? ""});
    }

    if (action === "send") {
      if (!isSmsConfigured()) {
        return jsonResponse({error: "SMSAPI_TOKEN is not configured"}, 500);
      }

      const recipients = Array.isArray(body.recipients) ? body.recipients : [];

      if (recipients.length === 0) {
        return jsonResponse({error: "recipients is required"}, 400);
      }

      if (recipients.length > MAX_RECIPIENTS) {
        return jsonResponse(
          {error: `Too many recipients (max ${MAX_RECIPIENTS})`},
          400,
        );
      }

      const sent: Array<Record<string, unknown>> = [];
      const failed: Array<Record<string, unknown>> = [];

      for (const item of recipients) {
        const phone = normalizePhone(item.phone);
        const message = String(item.message ?? "").trim();
        const clientId = String(item.clientId ?? "").trim();
        const clientName = String(item.clientName ?? "").trim();

        if (!phone || !message) {
          failed.push({
            clientId,
            clientName,
            error: "phone or message missing",
            phone,
            status: "failed",
          });
          continue;
        }

        const result = await sendSms({to: phone, message});
        const entry = {
          clientId,
          clientName,
          message,
          phone,
          providerMessageId: result.messageId ?? "",
          status: result.ok ? "sent" : "failed",
          error: result.error ?? "",
        };

        if (result.ok) {
          sent.push(entry);
        } else {
          failed.push(entry);
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      return jsonResponse({
        configured: true,
        failed,
        failedCount: failed.length,
        segmentId: String(body.segmentId ?? ""),
        sent,
        sentCount: sent.length,
        templateName: String(body.templateName ?? ""),
      });
    }

    return jsonResponse({error: "Unknown action"}, 400);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      {error: error instanceof Error ? error.message : "Bulk SMS failed"},
      500,
    );
  }
});
