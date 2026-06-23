import {describe, expect, it} from "vitest";
import {getTodayInput} from "./dateHelpers.js";
import {buildTodayFreeSlots} from "./calendarFreeSlots.js";
import {buildTodayDashboard} from "./todayDashboard.js";

describe("calendarFreeSlots", () => {
  it("finds free windows between visits", () => {
    const today = getTodayInput();
    const slots = buildTodayFreeSlots({
      appSettings: {workdayStart: "08:00", workdayEnd: "18:00"},
      calendarEntries: [
        {
          id: "1",
          kind: "visit",
          date: today,
          time: "10:00",
          duration: 60,
          master: "Kasia",
          status: "scheduled",
        },
        {
          id: "2",
          kind: "visit",
          date: today,
          time: "12:00",
          duration: 60,
          master: "Kasia",
          status: "scheduled",
        },
      ],
      employees: [{name: "Kasia", shiftStart: "08:00", shiftEnd: "18:00"}],
      now: new Date(`${today}T08:00:00`),
      today,
    });

    expect(slots.some((slot) => slot.startTime === "11:00" && slot.endTime === "12:00")).toBe(
      true,
    );
    expect(slots.some((slot) => slot.startTime === "13:00")).toBe(true);
  });
});

describe("todayDashboard", () => {
  it("builds snapshot and operational lists", () => {
    const today = getTodayInput();
    const [, month, day] = today.split("-");
    const dashboard = buildTodayDashboard({
      alertSummary: {revenueToday: 900, urgentCount: 1},
      alerts: [{id: "a1", priority: "critical", title: "Test alert"}],
      calendarEntries: [
        {
          id: "v1",
          kind: "visit",
          date: today,
          time: "10:00",
          client: "Anna",
          service: "Relaks",
          master: "Kasia",
          status: "scheduled",
        },
      ],
      clientProfiles: [
        {id: 1, name: "Anna", birthday: `2000-${month}-${day}`},
      ],
      employees: [{name: "Kasia", shiftStart: "08:00", shiftEnd: "18:00"}],
      now: new Date(`${today}T09:00:00`),
      supplies: [{id: 1, name: "Oil", stock: 1, minStock: 5, unit: "шт"}],
      tasks: [
        {
          id: "t1",
          type: "task",
          title: "Call supplier",
          dueDate: today,
          status: "active",
        },
      ],
      visits: [],
    });

    expect(dashboard.snapshot.scheduledVisits).toBe(1);
    expect(dashboard.dueTasks).toHaveLength(1);
    expect(dashboard.lowStockSupplies).toHaveLength(1);
    expect(dashboard.todayBirthdays).toHaveLength(1);
    expect(dashboard.priorityAlerts).toHaveLength(1);
    expect(dashboard.actionItems.length).toBeGreaterThan(0);
    expect(dashboard.actionItems.some((item) => item.type === "task")).toBe(true);
    expect(dashboard.actionItems.some((item) => item.type === "birthday")).toBe(true);
    expect(dashboard.forecastRevenue).toBe(900);
  });
});
