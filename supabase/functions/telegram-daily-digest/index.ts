import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {
  getTelegramChatId,
  isTelegramConfigured,
  isTelegramReady,
  sendTelegramMessage,
} from "../_shared/telegram.ts";
import {
  buildTelegramDigestMessage,
  canSendTelegramDigest,
} from "../_shared/telegramDigest.ts";
import {notifyOwnerAboutSiteBooking} from "../_shared/siteBookingNotify.ts";
import {getOwnerNotifyPhone, isWhatsappConfigured} from "../_shared/whatsapp.ts";
import {isSmsConfigured} from "../_shared/smsapi.ts";

type SnapshotPayload = {
  settings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  certificates?: Array<Record<string, unknown>>;
  clientPackages?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  employees?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
};

const authorizeCron = (request: Request, body: Record<string, unknown>) => {
  const cronSecret = String(Deno.env.get("TELEGRAM_DIGEST_CRON_SECRET") ?? "").trim();
  const headerSecret = String(request.headers.get("x-cron-secret") ?? "").trim();

  if (body.action !== "cron") {
    return false;
  }

  return Boolean(cronSecret && headerSecret && cronSecret === headerSecret);
};

const loadSnapshotForUser = async (
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) => {
  const {data, error} = await admin
    .from("crm_snapshots")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    payload: (data?.payload ?? {}) as SnapshotPayload,
    updatedAt: data?.updated_at ?? null,
  };
};

const saveSnapshotForUser = async (
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: SnapshotPayload,
) => {
  const {error} = await admin.from("crm_snapshots").upsert({
    user_id: userId,
    payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
};

const buildDigestFromPayload = (payload: SnapshotPayload) =>
  buildTelegramDigestMessage({
    appSettings: payload.settings ?? {},
    calendarEntries: payload.calendarEntries ?? [],
    certificates: payload.certificates ?? [],
    clientPackages: payload.clientPackages ?? [],
    clients: payload.clients ?? [],
    employees: payload.employees ?? [],
    visits: payload.visits ?? [],
  });

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const body =
      request.method === "POST"
        ? await request.json().catch(() => ({}))
        : {};
    let action = String(body.action ?? "preview");
    const isCron = authorizeCron(request, body);

    let userId = "";

    if (isCron) {
      userId = String(Deno.env.get("CRM_OWNER_USER_ID") ?? "").trim();

      if (!userId) {
        return jsonResponse({error: "CRM_OWNER_USER_ID is not configured"}, 500);
      }

      action = "process";
    } else {
      const {user} = await requireUser(request);
      userId = user.id;
    }

    const admin = createAdminClient();
    const {payload} = await loadSnapshotForUser(admin, userId);
    const appSettings = payload.settings ?? {};
    const chatId = getTelegramChatId(appSettings);
    const telegramTokenConfigured = isTelegramConfigured();
    const telegramChatIdConfigured = Boolean(chatId);
    const configured = isTelegramReady(appSettings);

    if (action === "owner-notify-status") {
      return jsonResponse({
        ownerPhone: getOwnerNotifyPhone(appSettings),
        siteBookingNotifyTelegramEnabled:
          appSettings.siteBookingNotifyTelegramEnabled !== false,
        siteBookingNotifyWhatsappEnabled:
          appSettings.siteBookingNotifyWhatsappEnabled !== false,
        smsConfigured: isSmsConfigured(),
        telegramChatId: chatId,
        telegramChatIdConfigured,
        telegramConfigured: configured,
        telegramTokenConfigured,
        whatsappConfigured: isWhatsappConfigured(),
      });
    }

    if (action === "owner-notify-test") {
      const results = await notifyOwnerAboutSiteBooking({
        appSettings,
        booking: {
          clientEmail: "test@nuarr.pl",
          clientName: "Test Klient",
          clientPhone: "48111222333",
          durationMinutes: 60,
          note: "Test powiadomienia z CRM",
          preferredDate: new Date().toISOString().slice(0, 10),
          preferredMaster: "Olha",
          preferredTime: "12:00",
          serviceName: "Masaz testowy",
        },
      });

      return jsonResponse({
        ok: true,
        results,
        telegramConfigured: configured,
      });
    }

    if (action === "status") {
      const {message} = buildDigestFromPayload(payload);

      return jsonResponse({
        configured,
        telegramChatIdConfigured,
        telegramTokenConfigured,
        lastRunAt: appSettings.telegramDigestLastRunAt ?? "",
        previewMessage: message,
      });
    }

    if (action === "test") {
      const message = String(body.message ?? "NUAR CRM Telegram test").trim();

      if (!message) {
        return jsonResponse({error: "message is required"}, 400);
      }

      const result = await sendTelegramMessage({chatId, message});

      return jsonResponse({
        configured,
        result,
      });
    }

    const {message, sections} = buildDigestFromPayload(payload);
    const dryRun = action === "preview";

    if (dryRun) {
      return jsonResponse({
        action,
        configured,
        message,
        sections,
      });
    }

    const decision = canSendTelegramDigest({
      appSettings,
      force: !isCron,
      lastRunAt: appSettings.telegramDigestLastRunAt ?? "",
    });

    if (!decision.allowed) {
      return jsonResponse({
        action,
        configured,
        message,
        reason: decision.reason,
        sent: false,
        skipped: true,
      });
    }

    if (!configured || !chatId) {
      return jsonResponse({
        action,
        configured: false,
        error: "Telegram is not configured",
        sent: false,
        skipped: true,
      });
    }

    const result = await sendTelegramMessage({chatId, message});

    if (!result.ok) {
      return jsonResponse({
        action,
        configured: true,
        error: result.error,
        sent: false,
        skipped: false,
      });
    }

    const nextPayload: SnapshotPayload = {
      ...payload,
      settings: {
        ...appSettings,
        telegramDigestLastRunAt: new Date().toISOString(),
      },
    };

    await saveSnapshotForUser(admin, userId, nextPayload);

    await admin.from("telegram_digest_runs").insert({
      user_id: userId,
      action: isCron ? "cron" : "process",
      message_length: message.length,
      details: {
        reason: decision.reason,
        visitsToday: sections.visitsToday?.length ?? 0,
        messageId: result.messageId ?? "",
      },
    });

    return jsonResponse({
      action,
      configured: true,
      message,
      messageId: result.messageId ?? "",
      reason: decision.reason,
      sent: true,
      skipped: false,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected Telegram digest error",
      },
      500,
    );
  }
});
