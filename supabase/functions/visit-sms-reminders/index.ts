import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {isSmsConfigured, sendSms} from "../_shared/smsapi.ts";
import {buildDueSmsReminders} from "../_shared/visitReminders.ts";

type SnapshotPayload = {
  settings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  messageTemplates?: Array<Record<string, unknown>>;
  smsReminderLog?: Array<Record<string, unknown>>;
  communicationLog?: Array<Record<string, unknown>>;
};

const createLogId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const authorizeCron = (request: Request, body: Record<string, unknown>) => {
  if (body.action !== "cron") {
    return false;
  }

  const cronSecret = String(Deno.env.get("VISIT_SMS_CRON_SECRET") ?? "").trim();
  const headerSecret = String(request.headers.get("x-cron-secret") ?? "").trim();

  if (cronSecret && headerSecret && cronSecret === headerSecret) {
    return true;
  }

  const authHeader = String(request.headers.get("Authorization") ?? "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  return Boolean(
    serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`,
  );
};

const loadSnapshotForUser = async (admin: ReturnType<typeof createAdminClient>, userId: string) => {
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

const processReminders = async ({
  dryRun = false,
  payload,
}: {
  dryRun?: boolean;
  payload: SnapshotPayload;
}) => {
  const appSettings = payload.settings ?? {};
  const due = buildDueSmsReminders({
    appSettings,
    calendarEntries: payload.calendarEntries ?? [],
    clientProfiles: payload.clients ?? [],
    messageTemplates: payload.messageTemplates ?? [],
    smsReminderLog: payload.smsReminderLog ?? [],
  });

  if (dryRun || !isSmsConfigured()) {
    return {
      communicationLog: payload.communicationLog ?? [],
      processed: due.map((item) => ({
        ...item,
        status: item.status === "pending" ? "preview" : item.status,
      })),
      sent: [],
      skipped: due.filter((item) => item.status === "skipped"),
      smsReminderLog: payload.smsReminderLog ?? [],
      configured: isSmsConfigured(),
    };
  }

  const smsReminderLog = [...(payload.smsReminderLog ?? [])];
  const communicationLog = [...(payload.communicationLog ?? [])];
  const sent: Array<Record<string, unknown>> = [];
  const failed: Array<Record<string, unknown>> = [];
  const skipped = due.filter((item) => item.status === "skipped");

  for (const item of due) {
    if (item.status !== "pending") {
      continue;
    }

    const result = await sendSms({
      to: String(item.phone),
      message: String(item.message),
      from: String(appSettings.smsSenderName ?? ""),
    });
    const logEntry = {
      id: createLogId(),
      key: item.key,
      calendarEntryId: item.calendarEntryId,
      kind: item.kind,
      client: item.client,
      phone: item.phone,
      visitDate: item.date,
      visitTime: item.time,
      message: item.message,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.messageId ?? "",
      error: result.error ?? "",
      sentAt: new Date().toISOString(),
    };

    smsReminderLog.unshift(logEntry);

    if (result.ok) {
      sent.push(logEntry);
      communicationLog.unshift({
        id: createLogId(),
        clientName: item.client,
        channel: "SMS",
        templateName:
          item.kind === "24h" ? "Auto 24h reminder" : "Auto 2h reminder",
        body: item.message,
        createdAt: logEntry.sentAt,
        automated: true,
      });
    } else {
      failed.push(logEntry);
    }
  }

  return {
    communicationLog,
    processed: due,
    sent,
    failed,
    skipped,
    smsReminderLog,
    configured: true,
  };
};

serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    const body =
      request.method === "POST"
        ? await request.json().catch(() => ({}))
        : {};
    let action = String(body.action ?? "preview");

    let userId = "";

    if (authorizeCron(request, body)) {
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

    if (action === "status") {
      const due = buildDueSmsReminders({
        appSettings: payload.settings ?? {},
        calendarEntries: payload.calendarEntries ?? [],
        clientProfiles: payload.clients ?? [],
        messageTemplates: payload.messageTemplates ?? [],
        smsReminderLog: payload.smsReminderLog ?? [],
      });

      return jsonResponse({
        configured: isSmsConfigured(),
        dueCount: due.filter((item) => item.status === "pending").length,
        lastRunAt: payload.settings?.smsRemindersLastRunAt ?? "",
        recentLog: (payload.smsReminderLog ?? []).slice(0, 10),
        skippedCount: due.filter((item) => item.status === "skipped").length,
      });
    }

    if (action === "test") {
      const phone = String(body.phone ?? "").trim();
      const message = String(body.message ?? "NUAR CRM test SMS").trim();

      if (!phone || !message) {
        return jsonResponse({error: "phone and message are required"}, 400);
      }

      const result = await sendSms({to: phone, message});

      return jsonResponse({
        configured: isSmsConfigured(),
        result,
      });
    }

    const dryRun = action === "preview";
    const result = await processReminders({dryRun, payload});

    if (!dryRun && action === "process") {
      const nextPayload: SnapshotPayload = {
        ...payload,
        communicationLog: result.communicationLog,
        smsReminderLog: result.smsReminderLog,
        settings: {
          ...(payload.settings ?? {}),
          smsRemindersLastRunAt: new Date().toISOString(),
        },
      };

      await saveSnapshotForUser(admin, userId, nextPayload);
    }

    return jsonResponse({
      action,
      configured: result.configured,
      sent: result.sent,
      failed: result.failed ?? [],
      skipped: result.skipped,
      due: result.processed,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected SMS reminder error",
      },
      500,
    );
  }
});
