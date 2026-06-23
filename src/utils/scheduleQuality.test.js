import {describe, expect, it} from "vitest";
import {buildScheduleQualityReport} from "./scheduleQuality.js";

describe("scheduleQuality", () => {
  it("detects calendar overlaps and missing visit data", () => {
    const report = buildScheduleQualityReport({
      clientProfiles: [{id: "c1", name: "Anna", phone: ""}],
      date: "2026-06-23",
      calendarEntries: [
        {
          id: "a",
          client: "Anna",
          clientId: "c1",
          date: "2026-06-23",
          duration: 60,
          kind: "visit",
          master: "Olga",
          service: "Massage",
          status: "confirmed",
          time: "10:00",
        },
        {
          id: "b",
          client: "Maria",
          date: "2026-06-23",
          duration: 60,
          kind: "visit",
          master: "Olga",
          service: "Massage",
          status: "scheduled",
          time: "10:30",
        },
        {
          amount: 0,
          client: "Kate",
          date: "2026-06-23",
          duration: 45,
          id: "c",
          kind: "visit",
          master: "Max",
          payment: "",
          status: "completed",
          time: "12:00",
        },
        {
          client: "Lena",
          date: "2026-06-23",
          duration: 45,
          id: "d",
          kind: "visit",
          master: "Max",
          status: "cancelled",
          time: "14:00",
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "overlap-a-b",
        "missing-phone-a",
        "missing-amount-c",
        "missing-payment-c",
        "missing-cancel-reason-d",
      ]),
    );
    expect(report.criticalCount).toBe(2);
  });

  it("returns ok report when schedule is clean", () => {
    const report = buildScheduleQualityReport({
      clientProfiles: [{id: "c1", name: "Anna", phone: "600123456"}],
      date: "2026-06-23",
      calendarEntries: [
        {
          amount: 300,
          client: "Anna",
          clientId: "c1",
          date: "2026-06-23",
          duration: 60,
          id: "a",
          kind: "visit",
          master: "Olga",
          payment: "Карта",
          status: "completed",
          time: "10:00",
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });
});
