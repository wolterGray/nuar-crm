import {describe, expect, it} from "vitest";
import {aggregateDisplayAlerts, getAggregateChildIds} from "./alertAggregation.js";

describe("alertAggregation", () => {
  const supplyAlert = (id, name) => ({
    id: `supply-${id}`,
    type: "supply",
    group: "operations",
    priority: "action",
    title: name,
    message: "low",
  });

  it("aggregates multiple supplies into one row", () => {
    const alerts = [
      supplyAlert(1, "Масло"),
      supplyAlert(2, "Полотенца"),
    ];

    const result = aggregateDisplayAlerts(alerts, {alertAggregationEnabled: true});

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("aggregate");
    expect(result[0].title).toContain("2 позиций");
    expect(getAggregateChildIds(result[0])).toEqual(["supply-1", "supply-2"]);
  });

  it("keeps single alerts when aggregation disabled", () => {
    const alerts = [supplyAlert(1, "Масло"), supplyAlert(2, "Полотенца")];
    const result = aggregateDisplayAlerts(alerts, {alertAggregationEnabled: false});

    expect(result).toHaveLength(2);
  });

  it("aggregates inactive clients above limit", () => {
    const alerts = Array.from({length: 6}, (_, index) => ({
      id: `inactive-${index + 1}`,
      type: "inactive",
      group: "inactive",
      priority: "info",
      title: `Клиент ${index + 1}`,
      message: "phone",
    }));

    const result = aggregateDisplayAlerts(alerts, {
      alertAggregationEnabled: true,
      inactiveClientAlertLimit: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0].aggregateKind).toBe("inactive");
  });
});
