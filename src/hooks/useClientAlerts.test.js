import {describe, expect, it} from "vitest";
import {
  isActionableServerVisitEvent,
  isStaleServerVisitEvent,
} from "./useClientAlerts.js";

describe("useClientAlerts server visit filtering", () => {
  it("treats a completed calendar entry as a stale server visit notification", () => {
    const now = new Date("2026-09-30T12:00:00");
    const event = {
      entityId: "42",
      payload: {date: "2026-09-30", time: "12:30"},
      type: "visit_upcoming",
    };
    const calendarEntry = {
      id: "42",
      date: "2026-09-30",
      status: "completed",
      time: "12:30",
    };

    expect(isStaleServerVisitEvent(event, now, calendarEntry)).toBe(true);
    expect(isActionableServerVisitEvent(event, now, calendarEntry)).toBe(false);
  });

  it("keeps only today's near server visit notifications actionable", () => {
    const now = new Date("2026-09-30T12:00:00");

    expect(
      isActionableServerVisitEvent(
        {
          payload: {date: "2026-09-30", time: "13:00"},
          type: "visit_upcoming",
        },
        now,
        null,
        90,
      ),
    ).toBe(true);
    expect(
      isActionableServerVisitEvent(
        {
          payload: {date: "2026-09-30", time: "16:00"},
          type: "visit_upcoming",
        },
        now,
        null,
        90,
      ),
    ).toBe(false);
  });
});
