import {describe, expect, it} from "vitest";
import {getCalendarConflicts, getCalendarShiftWarning} from "./calendarConflicts.js";

describe("getCalendarConflicts", () => {
  it("finds overlapping visits for the same master", () => {
    const calendarEntries = [
      {
        date: "2026-06-11",
        duration: 60,
        id: "a",
        master: "Max",
        status: "scheduled",
        time: "10:00",
      },
      {
        date: "2026-06-11",
        duration: 60,
        id: "b",
        master: "Max",
        status: "scheduled",
        time: "10:30",
      },
    ];

    expect(
      getCalendarConflicts(
        {
          date: "2026-06-11",
          duration: 60,
          id: "c",
          master: "Max",
          status: "scheduled",
          time: "11:00",
        },
        calendarEntries,
      ),
    ).toHaveLength(1);
  });

  it("finds conflicts for every master in a parallel visit", () => {
    const calendarEntries = [
      {
        date: "2026-06-11",
        duration: 60,
        id: "a",
        master: "Алена",
        status: "scheduled",
        time: "10:30",
      },
    ];

    expect(
      getCalendarConflicts(
        {
          date: "2026-06-11",
          duration: 60,
          id: "b",
          master: "Max",
          parallelEmployees: [{name: "Max"}, {name: "Алена"}],
          status: "scheduled",
          time: "10:00",
        },
        calendarEntries,
      ),
    ).toHaveLength(1);
  });
});

describe("getCalendarShiftWarning", () => {
  it("warns when visit exceeds employee shift", () => {
    const warning = getCalendarShiftWarning(
      {duration: 120, master: "Max", time: "21:00"},
      {
        appSettings: {workdayEnd: "22:00", workdayStart: "08:00"},
        employees: [
          {
            name: "Max",
            shiftEnd: "22:00",
            shiftStart: "09:00",
          },
        ],
      },
    );

    expect(warning).toContain("Max");
  });

  it("warns when employee is unavailable on the selected date", () => {
    const warning = getCalendarShiftWarning(
      {date: "2026-08-16", duration: 60, master: "Алена", time: "10:00"},
      {
        appSettings: {workdayEnd: "22:00", workdayStart: "08:00"},
        employees: [
          {
            name: "Алена",
            shiftEnd: "22:00",
            shiftStart: "08:00",
            workingDaysOfWeek: [1, 2, 3, 4, 5, 6],
          },
        ],
      },
    );

    expect(warning).toContain("не работает");
  });
});
