import {describe, expect, it} from "vitest";
import {
  buildDueInactiveFollowUps,
  buildInactiveFollowUpKey,
  resolveNextInactiveFollowUpKind,
  wasInactiveFollowUpSent,
} from "./inactiveFollowUp.js";

describe("inactiveFollowUp", () => {
  const appSettings = {
    inactiveFollowUpEnabled: true,
    inactiveFollowUp14Enabled: true,
    inactiveFollowUp30Enabled: true,
    inactiveFollowUp60Enabled: true,
    studioName: "NUAR",
  };

  const clientProfiles = [
    {
      id: "c1",
      name: "Anna",
      phone: "600123456",
    },
  ];

  it("builds follow-up key", () => {
    expect(buildInactiveFollowUpKey("c1", "14d")).toBe("inactive:c1:14d");
  });

  it("detects sent follow-ups", () => {
    expect(
      wasInactiveFollowUpSent(
        [{clientId: "c1", kind: "14d", status: "sent"}],
        "c1",
        "14d",
      ),
    ).toBe(true);
  });

  it("picks lowest unsent tier first", () => {
    expect(
      resolveNextInactiveFollowUpKind({
        appSettings,
        client: {id: "c1", daysAbsent: 45},
        inactiveFollowUpLog: [
          {clientId: "c1", kind: "14d", status: "sent", key: "inactive:c1:14d"},
        ],
      }),
    ).toBe("30d");
  });

  it("builds pending follow-up for inactive client", () => {
    const due = buildDueInactiveFollowUps({
      appSettings,
      calendarEntries: [],
      clientProfiles,
      inactiveFollowUpLog: [],
      now: new Date("2026-06-12T12:00:00"),
      visits: [{client: "Anna", date: "01.05.2026"}],
    });

    expect(due).toHaveLength(1);
    expect(due[0].kind).toBe("14d");
    expect(due[0].status).toBe("pending");
    expect(due[0].phone).toBe("48600123456");
  });

  it("skips clients with upcoming visit", () => {
    const due = buildDueInactiveFollowUps({
      appSettings,
      calendarEntries: [
        {
          id: "v1",
          kind: "visit",
          client: "Anna",
          date: "2026-06-13",
          time: "14:00",
          duration: 60,
          status: "planned",
        },
      ],
      clientProfiles,
      inactiveFollowUpLog: [],
      now: new Date("2026-06-12T12:00:00"),
      visits: [{client: "Anna", date: "01.05.2026"}],
    });

    expect(due[0].status).toBe("skipped");
    expect(due[0].error).toBe("upcoming_visit");
  });
});
