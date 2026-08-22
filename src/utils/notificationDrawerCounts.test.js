import {describe, expect, it} from "vitest";
import {getNotificationDrawerCounts} from "./notificationDrawerCounts.js";

const buildAlert = (id, priority = "info") => ({
  actions: ["open", "snooze"],
  group: "inactive",
  id,
  message: "40 дней",
  page: "clients",
  priority,
  title: id,
  type: "inactive",
});

describe("notificationDrawerCounts", () => {
  it("uses the visible filtered list for both drawer count and bell badge", () => {
    const visibleAlerts = Array.from({length: 13}, (_, index) =>
      buildAlert(`inactive-${index + 1}`, index < 3 ? "action" : "info"),
    );

    const result = getNotificationDrawerCounts({
      alerts: visibleAlerts,
      now: 1000,
    });

    expect(result.alertsCount).toBe(13);
    expect(result.badgeCount).toBe(13);
    expect(result.totalAlertsCount).toBe(13);
    expect(result.urgentAlertsCount).toBe(3);
  });

  it("immediately reduces counts for locally swiped notifications", () => {
    const result = getNotificationDrawerCounts({
      alerts: [buildAlert("inactive-1", "action"), buildAlert("inactive-2")],
      locallyHiddenAlerts: {"inactive-1": 2000},
      now: 1000,
    });

    expect(result.visibleAlerts.map((alert) => alert.id)).toEqual(["inactive-2"]);
    expect(result.badgeCount).toBe(1);
    expect(result.alertsCount).toBe(1);
    expect(result.urgentAlertsCount).toBe(0);
  });

  it("reduces aggregate children without keeping stale child counts", () => {
    const aggregate = {
      actions: ["open", "snooze"],
      aggregateKind: "inactive",
      children: [buildAlert("inactive-1"), buildAlert("inactive-2")],
      group: "inactive",
      id: "aggregate-inactive",
      message: "Anna и Maria",
      page: "clients",
      priority: "info",
      title: "Клиенты",
      type: "aggregate",
    };

    const result = getNotificationDrawerCounts({
      alerts: [aggregate],
      locallyHiddenAlerts: {"inactive-1": 2000},
      now: 1000,
    });

    expect(result.badgeCount).toBe(1);
    expect(result.visibleAlerts[0].children.map((alert) => alert.id)).toEqual(["inactive-2"]);
  });
});
