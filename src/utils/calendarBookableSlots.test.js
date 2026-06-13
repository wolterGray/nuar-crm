import {describe, expect, it} from "vitest";
import {
  buildBookableSlots,
  isBookableSlotAvailable,
} from "./calendarBookableSlots.js";

describe("calendarBookableSlots", () => {
  const appSettings = {workdayStart: "08:00", workdayEnd: "18:00"};
  const employees = [{name: "Ольга", shiftStart: "08:00", shiftEnd: "18:00"}];

  it("excludes occupied visit windows from bookable slots", () => {
    const slots = buildBookableSlots({
      appSettings,
      calendarEntries: [
        {
          id: "1",
          kind: "visit",
          date: "20.06.2026",
          time: "10:00",
          duration: 60,
          master: "Ольга",
          status: "scheduled",
        },
      ],
      date: "2026-06-20",
      durationMinutes: 60,
      employees,
      now: new Date("2026-06-20T08:00:00"),
    });

    expect(slots.some((slot) => slot.startTime === "10:00")).toBe(false);
    expect(slots.some((slot) => slot.startTime === "11:00")).toBe(true);
  });

  it("treats pending site bookings as occupied", () => {
    const slots = buildBookableSlots({
      appSettings,
      calendarEntries: [],
      date: "2026-06-20",
      durationMinutes: 60,
      employees,
      now: new Date("2026-06-20T08:00:00"),
      pendingBookings: [
        {
          duration_minutes: 60,
          preferred_date: "2026-06-20",
          preferred_master: "Olha",
          preferred_time: "14:00:00",
          status: "pending",
        },
      ],
    });

    expect(slots.some((slot) => slot.startTime === "14:00")).toBe(false);
  });

  it("returns default masters when employees list is empty", () => {
    const slots = buildBookableSlots({
      appSettings: {workdayStart: "08:00", workdayEnd: "18:00"},
      calendarEntries: [],
      date: "2026-06-20",
      durationMinutes: 60,
      employees: [],
      now: new Date("2026-06-20T08:00:00"),
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.some((slot) => slot.master === "Ольга")).toBe(true);
  });

  it("blocks Max at 15:30 when calendar master uses Latin name", () => {
    const slots = buildBookableSlots({
      appSettings: {workdayStart: "08:00", workdayEnd: "22:00"},
      calendarEntries: [
        {
          id: "1",
          kind: "visit",
          date: "13.06.2026",
          time: "15:30",
          duration: 60,
          master: "Max",
          status: "scheduled",
        },
      ],
      date: "2026-06-13",
      durationMinutes: 60,
      employees: [{name: "Max", shiftStart: "08:00", shiftEnd: "22:00"}],
      now: new Date("2026-06-13T08:00:00"),
      preferredMaster: "Max",
    });

    expect(slots.some((slot) => slot.startTime === "15:30")).toBe(false);
  });

  it("validates selected slot availability", () => {
    expect(
      isBookableSlotAvailable({
        appSettings,
        calendarEntries: [
          {
            id: "1",
            kind: "visit",
            date: "20.06.2026",
            time: "10:00",
            duration: 60,
            master: "Ольга",
            status: "scheduled",
          },
        ],
        date: "2026-06-20",
        durationMinutes: 60,
        employees,
        preferredMaster: "Olha",
        preferredTime: "10:00",
      }),
    ).toBe(false);
  });
});
