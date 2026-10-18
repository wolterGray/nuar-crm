import {describe, expect, it} from "vitest";
import {defaultAppSettings} from "../constants/appDefaults.js";
import {buildAlertCenter, filterAlertsByMode, isUnclosedPastVisit} from "./alertCenter.js";

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

  it("keeps undo events in history and does not recreate a dismissed undo", () => {
    const notification = {
      archivedAt: "2026-06-11T09:30:00.000Z",
      id: "package-delete-1",
      message: "Anna · Пакет 5+1",
      title: "Пакет клиента удален",
      undoAction: {type: "restore-client-package", payload: {id: 7}},
    };
    const build = (dismissedAlertIds = []) => buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds,
      inactiveClientDays: 14,
      notificationInbox: [notification],
      snoozes: {},
      supplies: [],
      tasks: [],
      visits: [],
      now: new Date("2026-06-11T10:00:00"),
    });

    const visible = build();
    expect(visible.urgentCount).toBe(0);
    expect(filterAlertsByMode(visible.alerts, "information")).toHaveLength(1);
    expect(visible.alerts[0]).toMatchObject({
      id: "undo-package-delete-1",
      priority: "info",
      type: "undo",
    });

    expect(build(["undo-package-delete-1"]).alerts).toHaveLength(0);
  });

  it("filters urgent mode", () => {
    const alerts = [
      {id: "1", priority: "critical"},
      {id: "2", priority: "info"},
    ];

    expect(filterAlertsByMode(alerts, "urgent")).toHaveLength(1);
  });

  it("filters today mode by the alert entity date", () => {
    const today = new Date();
    const todayInput = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const alerts = [
      {id: "today", type: "task", meta: {task: {dueDate: todayInput}}},
      {id: "old", type: "task", meta: {task: {dueDate: "2020-01-01"}}},
      {id: "calendar", type: "calendar", meta: {entry: {date: todayInput}}},
    ];

    expect(filterAlertsByMode(alerts, "today").map((alert) => alert.id)).toEqual([
      "today",
      "calendar",
    ]);
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

  it("raises a critical alert for an unclosed past visit", () => {
    const now = new Date("2026-09-28T12:00:00");
    const result = buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [
        {
          id: "v-old",
          kind: "visit",
          date: "2026-09-27",
          time: "15:00",
          client: "Anna",
          service: "Massage",
          status: "scheduled",
        },
      ],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: [],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {},
      supplies: [],
      tasks: [],
      visits: [],
      now,
    });

    expect(isUnclosedPastVisit(result.rawAlerts[0].meta.entry, now)).toBe(true);
    expect(result.rawAlerts[0]).toMatchObject({
      group: "closing",
      id: "unclosed-visit-v-old",
      priority: "critical",
      type: "unclosed_visit",
    });
    expect(filterAlertsByMode(result.rawAlerts, "closing")).toHaveLength(1);
  });

  it("does not turn the whole remaining day schedule into notifications", () => {
    const result = buildAlertCenter({
      appSettings: {...baseSettings, upcomingVisitMinutes: 60},
      calendarEntries: [
        {
          id: "v-near",
          kind: "visit",
          date: "2026-09-28",
          time: "12:30",
          client: "Near",
          status: "scheduled",
        },
        {
          id: "v-late",
          kind: "visit",
          date: "2026-09-28",
          time: "18:00",
          client: "Late",
          status: "scheduled",
        },
      ],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: [],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {},
      supplies: [],
      tasks: [],
      visits: [],
      now: new Date("2026-09-28T12:00:00"),
    });

    expect(result.rawAlerts.map((alert) => alert.entityId)).toEqual(["v-near"]);
  });

  it("keeps financial quality alerts in a separate finance filter", () => {
    const result = buildAlertCenter({
      appSettings: baseSettings,
      calendarEntries: [
        {
          id: "v-money",
          kind: "visit",
          date: "2026-09-28",
          time: "12:30",
          client: "Natalia",
          status: "completed",
        },
      ],
      clientPackages: [],
      clientProfiles: [],
      defaultAppSettings,
      dismissedAlertIds: [],
      inactiveClientDays: 14,
      notificationInbox: [],
      snoozes: {},
      supplies: [],
      tasks: [],
      visits: [],
      now: new Date("2026-09-28T12:00:00"),
    });
    const financeAlerts = filterAlertsByMode(result.rawAlerts, "finance");

    expect(financeAlerts).toHaveLength(1);
    expect(financeAlerts[0]).toMatchObject({
      group: "finance",
      type: "financial_quality",
    });
  });
});
