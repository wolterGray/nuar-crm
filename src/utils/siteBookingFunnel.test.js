import {describe, expect, it} from "vitest";
import {buildSiteBookingFunnel} from "./siteBookingFunnel.js";

describe("siteBookingFunnel", () => {
  it("counts request stages and stale pending requests", () => {
    const report = buildSiteBookingFunnel({
      now: new Date("2026-06-23T12:00:00Z"),
      pendingStaleHours: 2,
      requests: [
        {
          client_name: "Anna",
          created_at: "2026-06-23T08:30:00Z",
          status: "pending",
        },
        {
          client_name: "Maria",
          created_at: "2026-06-23T11:30:00Z",
          status: "pending",
        },
        {
          created_at: "2026-06-23T09:00:00Z",
          status: "applied",
          updated_at: "2026-06-23T09:30:00Z",
        },
        {
          created_at: "2026-06-23T10:00:00Z",
          status: "rejected",
          updated_at: "2026-06-23T11:00:00Z",
        },
      ],
    });

    expect(report.statusCounts).toMatchObject({
      applied: 1,
      pending: 2,
      rejected: 1,
    });
    expect(report.averageResponseMinutes).toBe(45);
    expect(report.averageResponseLabel).toBe("45 мин");
    expect(report.stalePendingRequests).toHaveLength(1);
    expect(report.stalePendingRequests[0].client_name).toBe("Anna");
  });
});
