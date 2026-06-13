import {describe, expect, it} from "vitest";
import {
  buildWaitlistEntry,
  findWaitlistMatches,
  matchesWaitlistPreferences,
} from "./waitlist.js";

describe("waitlist", () => {
  const clients = [{id: "c1", name: "Anna"}];

  it("creates waitlist entry for linked client", () => {
    const entry = buildWaitlistEntry({
      client: clients[0],
      clientProfiles: clients,
      createId: () => "w1",
      preferredDate: "2026-06-15",
      preferredMaster: "Kasia",
    });

    expect(entry?.clientId).toBe("c1");
    expect(entry?.status).toBe("active");
  });

  it("matches slot by date master and time", () => {
    expect(
      matchesWaitlistPreferences(
        {
          status: "active",
          preferredDate: "2026-06-15",
          preferredMaster: "Kasia",
          preferredTimeFrom: "10:00",
          preferredTimeTo: "14:00",
        },
        {
          date: "2026-06-15",
          time: "12:00",
          master: "Kasia",
          service: "Relaks",
        },
      ),
    ).toBe(true);

    expect(
      matchesWaitlistPreferences(
        {
          status: "active",
          preferredDate: "2026-06-15",
          preferredMaster: "Kasia",
          preferredTimeFrom: "10:00",
          preferredTimeTo: "11:00",
        },
        {
          date: "2026-06-15",
          time: "12:00",
          master: "Kasia",
        },
      ),
    ).toBe(false);
  });

  it("finds waitlist matches excluding cancelled client", () => {
    const matches = findWaitlistMatches({
      excludeClientId: "c9",
      slot: {
        date: "2026-06-15",
        time: "12:00",
        master: "Kasia",
        service: "Relaks",
      },
      waitlistEntries: [
        {
          id: "w1",
          clientId: "c1",
          clientName: "Anna",
          status: "active",
          createdAt: "2026-06-01T10:00:00.000Z",
          preferredMaster: "Kasia",
        },
        {
          id: "w2",
          clientId: "c9",
          clientName: "Cancelled",
          status: "active",
          createdAt: "2026-06-02T10:00:00.000Z",
        },
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].clientName).toBe("Anna");
  });
});
