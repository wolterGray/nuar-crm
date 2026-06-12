import {describe, expect, it} from "vitest";
import {
  applyQuietHoursFilter,
  isQuietHours,
  shouldShowSmartVisitPopup,
} from "./quietHours.js";

describe("quietHours", () => {
  const settings = {
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  };

  it("detects quiet hours across midnight", () => {
    expect(isQuietHours(new Date("2026-06-11T23:00:00"), settings)).toBe(true);
    expect(isQuietHours(new Date("2026-06-11T10:00:00"), settings)).toBe(false);
  });

  it("keeps only critical alerts during quiet hours", () => {
    const alerts = [
      {id: "1", priority: "critical"},
      {id: "2", priority: "action"},
    ];

    expect(
      applyQuietHoursFilter(alerts, settings, new Date("2026-06-11T23:00:00")),
    ).toEqual([{id: "1", priority: "critical"}]);
  });

  it("limits smart visit popups at night", () => {
    expect(shouldShowSmartVisitPopup(10, settings, new Date("2026-06-11T23:00:00"))).toBe(
      false,
    );
    expect(shouldShowSmartVisitPopup(0, settings, new Date("2026-06-11T23:00:00"))).toBe(
      true,
    );
  });
});
