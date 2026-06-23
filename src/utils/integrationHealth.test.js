import {describe, expect, it} from "vitest";
import {buildIntegrationHealth} from "./integrationHealth.js";

describe("integrationHealth", () => {
  it("marks enabled and configured automations as ok", () => {
    const report = buildIntegrationHealth({
      now: new Date("2026-06-23T10:00:00Z"),
      settings: {
        gmailClientId: "client-id",
        smsRemindersEnabled: true,
        telegramDigestEnabled: true,
      },
      smsReminders: {
        status: {
          configured: true,
          dueCount: 0,
          lastRunAt: "2026-06-23T09:30:00Z",
        },
      },
      telegramDigest: {
        status: {
          lastRunAt: "2026-06-23T07:00:00Z",
          telegramChatIdConfigured: true,
          telegramTokenConfigured: true,
        },
      },
    });

    expect(report.items.find((item) => item.id === "sms-reminders")?.state).toBe(
      "ok",
    );
    expect(report.items.find((item) => item.id === "telegram-digest")?.state).toBe(
      "ok",
    );
  });

  it("detects disabled and stale integrations", () => {
    const report = buildIntegrationHealth({
      now: new Date("2026-06-23T10:00:00Z"),
      settings: {
        smsRemindersEnabled: true,
        telegramDigestEnabled: false,
      },
      smsReminders: {
        status: {
          configured: true,
          lastRunAt: "2026-06-23T01:00:00Z",
        },
      },
    });

    expect(report.items.find((item) => item.id === "telegram-digest")?.state).toBe(
      "off",
    );
    expect(report.items.find((item) => item.id === "telegram-digest")?.diagnostic).toContain(
      "Включите автоматизацию",
    );
    const smsHealth = report.items.find((item) => item.id === "sms-reminders");

    expect(smsHealth?.state).toBe("warning");
    expect(smsHealth?.diagnostic).toContain("GitHub Actions cron");
  });
});
