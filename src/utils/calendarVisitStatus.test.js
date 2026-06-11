import {describe, expect, it} from "vitest";
import {
  getMinutesFromTime,
  isCalendarVisitCompleted,
  isCalendarVisitPlanned,
} from "./calendarVisitStatus.js";

describe("calendarVisitStatus", () => {
  it("parses time to minutes", () => {
    expect(getMinutesFromTime("10:30")).toBe(630);
  });

  it("treats future same-day visit as planned", () => {
    const now = new Date("2026-06-11T09:00:00");

    expect(
      isCalendarVisitPlanned(
        {status: "scheduled", date: "2026-06-11", time: "12:00", duration: 60},
        now,
      ),
    ).toBe(true);
  });

  it("treats past same-day visit as completed", () => {
    const now = new Date("2026-06-11T15:00:00");

    expect(
      isCalendarVisitCompleted(
        {kind: "visit", status: "scheduled", date: "2026-06-11", time: "12:00", duration: 60},
        now,
      ),
    ).toBe(true);
  });
});
