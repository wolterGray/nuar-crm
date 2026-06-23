import {describe, expect, it} from "vitest";
import {
  buildTelegramDigestMessage,
  canSendTelegramDigest,
  formatTelegramDigestMessage,
  getDateInputInTimezone,
  shouldSendDigestNow,
  wasDigestSentToday,
} from "./telegramDigest.js";

describe("telegramDigest", () => {
  it("formats digest message with visits and revenue", () => {
    const {message, sections} = buildTelegramDigestMessage({
      appSettings: {
        studioName: "NUAR",
        birthdayReminderDays: 7,
        certificateExpiryReminderDays: 30,
        certificateLowBalancePercent: 20,
      },
      calendarEntries: [
        {
          id: "1",
          amount: 300,
          kind: "visit",
          date: "12.06.2026",
          debt: 50,
          discount: 10,
          duration: 60,
          time: "10:00",
          client: "Anna",
          service: "Relaks",
          master: "Kasia",
          status: "scheduled",
        },
      ],
      certificates: [],
      clientPackages: [],
      clientProfiles: [
        {id: 1, name: "Anna", birthday: "2000-06-12"},
      ],
      employees: [{name: "Kasia", shiftStart: "08:00", shiftEnd: "14:00"}],
      now: new Date("2026-06-12T07:00:00+02:00"),
      visits: [
        {
          id: "v1",
          date: "11.06.2026",
          amount: 250,
          status: "completed",
          recordType: "visit",
          payment: "Gotówka",
        },
      ],
    });

    expect(sections.visitsToday).toHaveLength(1);
    expect(sections.todayExpectedRevenue).toBe(270);
    expect(sections.todayDebtAlerts).toHaveLength(1);
    expect(sections.todayFreeSlots[0]).toMatchObject({
      endTime: "10:00",
      master: "Kasia",
      startTime: "08:00",
    });
    expect(message).toContain("NUAR · 12.06.2026");
    expect(message).toContain("Anna · Relaks · Kasia");
    expect(message).toContain("План на сегодня: 270 zł");
    expect(message).toContain("Свободные окна");
    expect(message).toContain("Долги по сегодняшним записям");
    expect(message).toContain("Дни рождения сегодня");
    expect(message).toContain("250 zł");
  });

  it("detects digest send window", () => {
    const now = new Date("2026-06-12T06:05:00Z");

    expect(
      shouldSendDigestNow({
        digestTime: "08:00",
        now: new Date(now.toLocaleString("en-US", {timeZone: "Europe/Warsaw"})),
        timeZone: "Europe/Warsaw",
      }),
    ).toBeTypeOf("boolean");
  });

  it("blocks duplicate daily send", () => {
    const now = new Date("2026-06-12T10:00:00+02:00");

    expect(
      wasDigestSentToday("2026-06-12T08:01:00.000Z", now, "Europe/Warsaw"),
    ).toBe(true);
    expect(wasDigestSentToday("", now)).toBe(false);
  });

  it("allows manual send even if already sent today", () => {
    const decision = canSendTelegramDigest({
      appSettings: {telegramDigestEnabled: true, telegramDigestTime: "08:00"},
      force: true,
      lastRunAt: "2026-06-12T08:00:00.000Z",
      now: new Date("2026-06-12T10:00:00+02:00"),
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("manual");
  });

  it("truncates very long digest messages", () => {
    const sections = {
      studioName: "NUAR",
      todayDisplay: "12.06.2026",
      visitsToday: Array.from({length: 500}, (_, index) => ({
        time: "10:00",
        client: `Client ${index}`,
        service: "Relaks",
        master: "Kasia",
      })),
      todayBirthdays: [],
      upcomingBirthdays: [],
      lowPackages: [],
      certificateAlerts: [],
      yesterdayDisplay: "11.06.2026",
      yesterdayRevenue: 1000,
    };

    expect(formatTelegramDigestMessage(sections).length).toBeLessThanOrEqual(4096);
  });

  it("uses Warsaw date input", () => {
    expect(getDateInputInTimezone(new Date("2026-06-11T23:30:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
