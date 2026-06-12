import {describe, expect, it} from "vitest";
import {
  buildDueSmsReminders,
  isSmsReminderDue,
  normalizePhoneForSms,
  wasSmsReminderSent,
} from "./smsReminders.js";

describe("smsReminders", () => {
  it("normalizes polish phone numbers", () => {
    expect(normalizePhoneForSms("+48 600 123 456")).toBe("48600123456");
    expect(normalizePhoneForSms("600123456")).toBe("48600123456");
  });

  it("detects due 2h reminder window", () => {
    const now = new Date("2026-06-12T12:05:00");

    expect(isSmsReminderDue({date: "12.06.2026", time: "14:00"}, "2h", now)).toBe(
      true,
    );
  });

  it("skips already sent reminders", () => {
    const entry = {id: "v1", date: "12.06.2026", time: "14:00"};
    const log = [
      {
        calendarEntryId: "v1",
        kind: "2h",
        status: "sent",
        visitDate: "12.06.2026",
        visitTime: "14:00",
      },
    ];

    expect(wasSmsReminderSent(log, entry, "2h")).toBe(true);
  });

  it("builds due reminders for upcoming visit", () => {
    const now = new Date("2026-06-11T14:05:00");
    const due = buildDueSmsReminders({
      appSettings: {
        smsRemindersEnabled: true,
        smsReminder24hEnabled: true,
        smsReminder2hEnabled: true,
        studioName: "NUAR",
      },
      calendarEntries: [
        {
          id: "visit-1",
          kind: "visit",
          status: "scheduled",
          client: "Anna",
          date: "12.06.2026",
          time: "14:00",
          service: "Masaz relaksacyjny",
          master: "Max",
        },
      ],
      clientProfiles: [{id: 1, name: "Anna", phone: "600123456"}],
      now,
      smsReminderLog: [],
    });

    expect(due.some((item) => item.kind === "24h" && item.status === "pending")).toBe(
      true,
    );
    expect(due[0]?.phone).toBe("48600123456");
  });
});
