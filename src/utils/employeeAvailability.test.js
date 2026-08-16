import {describe, expect, it} from "vitest";
import {
  getEmployeeBlockedDates,
  getEmployeeWorkingDays,
  isEmployeeAvailableOnDate,
  parseBlockedDatesText,
} from "./employeeAvailability.js";

describe("employeeAvailability", () => {
  it("defaults employees to every working day when schedule is not configured", () => {
    expect(getEmployeeWorkingDays({name: "Алена"})).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("marks an employee unavailable on disabled weekdays", () => {
    const employee = {name: "Алена", workingDaysOfWeek: [1, 2, 3, 4, 5, 6]};

    expect(isEmployeeAvailableOnDate(employee, "2026-08-16")).toBe(false);
    expect(isEmployeeAvailableOnDate(employee, "2026-08-17")).toBe(true);
  });

  it("parses blocked dates from text", () => {
    expect(parseBlockedDatesText("2026-08-20, 20.08.2026\n2026-08-21")).toEqual([
      "2026-08-20",
      "2026-08-21",
    ]);
    expect(getEmployeeBlockedDates({payload: {bookingBlockedDates: ["20.08.2026"]}})).toEqual([
      "2026-08-20",
    ]);
  });
});
