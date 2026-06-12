import {describe, expect, it} from "vitest";
import {
  getEndOfToday,
  getSnoozeUntilDays,
  isAlertHidden,
  isAlertSnoozed,
  pruneExpiredSnoozes,
} from "./alertSnooze.js";

describe("alertSnooze", () => {
  const now = new Date("2026-06-11T10:00:00");

  it("detects active snooze", () => {
    expect(
      isAlertSnoozed(
        "task-1",
        {"task-1": "2026-06-11T23:59:59.999Z"},
        now,
      ),
    ).toBe(true);
  });

  it("hides dismissed alerts permanently", () => {
    expect(isAlertHidden("task-1", ["task-1"], {}, now)).toBe(true);
  });

  it("prunes expired snoozes", () => {
    expect(
      pruneExpiredSnoozes(
        {
          active: "2026-06-12T10:00:00.000Z",
          expired: "2026-06-10T10:00:00.000Z",
        },
        now,
      ),
    ).toEqual({active: "2026-06-12T10:00:00.000Z"});
  });

  it("builds end of today and day offsets", () => {
    const end = getEndOfToday(now);
    expect(end.getHours()).toBe(23);
    expect(getSnoozeUntilDays(7, now).getDate()).toBe(18);
  });
});
