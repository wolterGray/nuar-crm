import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {requireUser} from "../_shared/auth.ts";
import {createAdminClient} from "../_shared/supabaseAdmin.ts";
import {handleOptions, jsonResponse} from "../_shared/cors.ts";
import {buildDueInactiveFollowUps} from "../_shared/inactiveFollowUp.ts";
import {isSmsConfigured, sendSms} from "../_shared/smsapi.ts";

type SnapshotPayload = {
  settings?: Record<string, unknown>;
  calendarEntries?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  messageTemplates?: Array<Record<string, unknown>>;
  visits?: Array<Record<string, unknown>>;
  inactiveFollowUpLog?: Array<Record<string, unknown>>;
  communicationLog?: Array<Record<string, unknown>>;
};

const createLogId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const authorizeCron = (request: Request, body: Record<string, unknown>) => {
  const cronSecret = String(Deno.env.get("INACTIVE_FOLLOW_UP_CRON_SECRET") ?? "").trim();
  const headerSecret = String(request.headers.get("x-cron-secret") ?? "").trim();

  if (body.action !== "cron") {
    return false;
  }

  return Boolean(cronSecret && headerSecret && cronSecret === headerSecret);
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

const processFollowUps = async ({
  dryRun = false,
  payload,
}: {
  dryRun?: boolean;
  payload: SnapshotPayload;
}) => {
  const appSettings = payload.settings ?? {};
  const due = buildDueInactiveFollowUps({
    appSettings,
    calendarEntries: payload.calendarEntries ?? [],
    clientProfiles: payload.clients ?? [],
    inactiveFollowUpLog: payload.inactiveFollowUpLog ?? [],
    messageTemplates: payload.messageTemplates ?? [],
    visits: payload.visits ?? [],
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
      inactiveFollowUpLog: payload.inactiveFollowUpLog ?? [],
      configured: isSmsConfigured(),
    };
  }

  const inactiveFollowUpLog = [...(payload.inactiveFollowUpLog ?? [])];
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
      clientId: item.clientId,
      kind: item.kind,
      client: item.client,
      phone: item.phone,
      daysAbsent: item.daysAbsent,
      lastVisit: item.lastVisit,
      message: item.message,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.messageId ?? "",
      error: result.error ?? "",
      sentAt: new Date().toISOString(),
    };

    inactiveFollowUpLog.unshift(logEntry);

    if (result.ok) {
      sent.push(logEntry);
      communicationLog.unshift({
        id: createLogId(),
        clientName: item.client,
        channel: "SMS",
        templateName: `Auto inactive follow-up ${item.kind}`,
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
    inactiveFollowUpLog,
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
      const due = buildDueInactiveFollowUps({
        appSettings: payload.settings ?? {},
        calendarEntries: payload.calendarEntries ?? [],
        clientProfiles: payload.clients ?? [],
        inactiveFollowUpLog: payload.inactiveFollowUpLog ?? [],
        messageTemplates: payload.messageTemplates ?? [],
        visits: payload.visits ?? [],
      });

      return jsonResponse({
        configured: isSmsConfigured(),
        dueCount: due.filter((item) => item.status === "pending").length,
        lastRunAt: payload.settings?.inactiveFollowUpLastRunAt ?? "",
        recentLog: (payload.inactiveFollowUpLog ?? []).slice(0, 10),
        skippedCount: due.filter((item) => item.status === "skipped").length,
      });
    }

    if (action === "test") {
      const phone = String(body.phone ?? "").trim();
      const message = String(body.message ?? "NUAR CRM inactive follow-up test").trim();

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
    const result = await processFollowUps({dryRun, payload});

    if (!dryRun && action === "process") {
      const nextPayload: SnapshotPayload = {
        ...payload,
        communicationLog: result.communicationLog,
        inactiveFollowUpLog: result.inactiveFollowUpLog,
        settings: {
          ...(payload.settings ?? {}),
          inactiveFollowUpLastRunAt: new Date().toISOString(),
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
        error:
          error instanceof Error
            ? error.message
            : "Unexpected inactive follow-up error",
      },
      500,
    );
  }
});
