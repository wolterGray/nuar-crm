import {describe, expect, it} from "vitest";
import {
  getPackagePlannedProgressLabel,
  getPackageUsedLabel,
  getPackageVisitProgressLabel,
} from "./packages.jsx";

describe("package visit progress", () => {
  it("shows the historical visit position instead of the current package progress", () => {
    const packageItem = {id: 10, remainingVisits: 1, totalVisits: 6};
    const entries = [
      {
        date: "2026-07-31",
        id: 1,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
      {
        date: "2026-08-02",
        id: 2,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
    ];

    expect(getPackageVisitProgressLabel(packageItem, entries[0], entries)).toBe("1/6");
    expect(getPackageVisitProgressLabel(packageItem, entries[1], entries)).toBe("2/6");
  });

  it("skips cancelled package visits", () => {
    const packageItem = {id: 10, remainingVisits: 4, totalVisits: 6};
    const entries = [
      {
        date: "2026-07-30",
        id: 1,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "cancelled",
        time: "10:00",
      },
      {
        date: "2026-07-31",
        id: 2,
        kind: "visit",
        packageSessionsUsed: 2,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
    ];

    expect(getPackageVisitProgressLabel(packageItem, entries[1], entries)).toBe("2/6");
  });

  it("previews the next package visit from ledger usage plus earlier planned bookings", () => {
    const packageItem = {id: 10, remainingVisits: 4, totalVisits: 6};
    const entries = [
      {
        date: "2026-07-31",
        id: 1,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
      {
        date: "2026-08-05",
        id: 2,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "scheduled",
        time: "14:45",
      },
    ];
    const currentEntry = {
      date: "2026-08-02",
      id: "new",
      kind: "visit",
      packageSessionsUsed: 1,
      packageUsageId: 10,
      status: "scheduled",
      time: "14:45",
    };

    expect(getPackagePlannedProgressLabel(packageItem, currentEntry, entries)).toBe("3/6");
  });

  it("does not count completed calendar entries twice when the package is already deducted", () => {
    const packageItem = {id: 10, remainingVisits: 4, totalVisits: 6};
    const entries = [
      {
        date: "2026-07-31",
        id: 1,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
      {
        date: "2026-08-02",
        id: 2,
        kind: "visit",
        packageSessionsUsed: 1,
        packageUsageId: 10,
        status: "completed",
        time: "14:45",
      },
    ];
    const currentEntry = {
      date: "2026-08-05",
      id: "new",
      kind: "visit",
      packageSessionsUsed: 1,
      packageUsageId: 10,
      status: "scheduled",
      time: "14:45",
    };

    expect(getPackagePlannedProgressLabel(packageItem, currentEntry, entries)).toBe("3/6");
  });

  it("deduplicates package write-off history by visit id", () => {
    const packageItem = {
      id: 10,
      remainingVisits: 4,
      totalVisits: 6,
      writeOffHistory: [
        {sessionsUsed: 1, visitId: 101},
        {sessionsUsed: 1, visitId: 102},
        {sessionsUsed: 1, visitId: 102},
      ],
    };
    const currentEntry = {
      date: "2026-08-05",
      id: "new",
      kind: "visit",
      packageSessionsUsed: 1,
      packageUsageId: 10,
      status: "scheduled",
      time: "14:45",
    };

    expect(getPackagePlannedProgressLabel(packageItem, currentEntry, [])).toBe("3/6");
  });

  it("uses the finished balance when write-off history is incomplete", () => {
    const packageItem = {
      id: 10,
      remainingVisits: 0,
      totalVisits: 6,
      writeOffHistory: [
        {sessionsUsed: 1, visitId: 101},
        {sessionsUsed: 1, visitId: 102},
        {sessionsUsed: 1, visitId: 103},
        {sessionsUsed: 1, visitId: 104},
        {sessionsUsed: 1, visitId: 105},
      ],
    };

    expect(getPackageUsedLabel(packageItem)).toBe("6/6");
  });
});
