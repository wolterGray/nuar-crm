import {describe, expect, it} from "vitest";
import {defaultAppSettings} from "../constants/appDefaults.js";
import {buildAlertCenter, filterAlertsByMode} from "./alertCenter.js";

describe("alertCenter", () => {
  const baseSettings = {...defaultAppSettings, notificationsEnabled: true};

  it("builds urgent task and supply alerts", () => {
    const result = buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: [],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {},
      supplies: [{id: 1, name: "Масло", stock: 0, minStock: 2, unit: "шт."}],
      tasks: [
        {
          id: 2,
          type: "task",
          title: "Заказать полотенца",
          dueDate: "2026-06-10",
          status: "active",
        },
      ],
      visits: [],
      now: new Date("2026-06-11T10:00:00"),
    });

    expect(result.totalCount).toBe(2);
    expect(result.urgentCount).toBe(2);
    expect(result.alerts.map((alert) => alert.type)).toEqual(["task", "supply"]);
  });

  it("respects snooze and dismiss filters", () => {
    const result = buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: ["task-2"],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {"supply-1": "2026-06-12T10:00:00.000Z"},
      supplies: [{id: 1, name: "Масло", stock: 1, minStock: 2, unit: "шт."}],
      tasks: [
        {
          id: 2,
          type: "task",
          title: "Скрытая",
          dueDate: "2026-06-11",
          status: "active",
        },
      ],
      visits: [],
      now: new Date("2026-06-11T10:00:00"),
    });

    expect(result.totalCount).toBe(0);
  });

  it("filters urgent mode", () => {
    const alerts = [
      {id: "1", priority: "critical"},
      {id: "2", priority: "info"},
    ];

    expect(filterAlertsByMode(alerts, "urgent")).toHaveLength(1);
  });

  it("aggregates low-stock supplies in display list", () => {
    const result = buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: [],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {},
      supplies: [
        {id: 1, name: "Масло", stock: 0, minStock: 2, unit: "шт."},
        {id: 2, name: "Полотенца", stock: 1, minStock: 3, unit: "шт."},
      ],
      tasks: [],
      visits: [],
      now: new Date("2026-06-11T10:00:00"),
    });

    expect(result.totalCount).toBe(1);
    expect(result.alerts[0].type).toBe("aggregate");
  });
});
