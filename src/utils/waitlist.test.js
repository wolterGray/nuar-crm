import {describe, expect, it} from "vitest";
import {
  buildWaitlistEntry,
  findWaitlistMatches,
  isWaitlistEntryActive,
  isWaitlistEntryCompleted,
  isWaitlistEntryDeleted,
  isWaitlistEntryOffered,
  matchesWaitlistPreferences,
  parseWaitlistEntryDetails,
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

  it("parses site booking entry details correctly", () => {
    const rawEntry = {
      id: 101,
      clientName: "Olha",
      note: "Телефон: +48452402306\nEmail: nuar.contact@gmail.com\nКомментарий: Болит поясница\nЗаявка сайта: 6bbc321a-a163-470a-b558-25cf19ba370e",
      payload: {
        source: "site-booking",
        clientPhone: "+48452402306",
        clientEmail: "nuar.contact@gmail.com",
        bookedPrice: 310,
        durationMinutes: 75,
        siteBookingRequestId: "6bbc321a-a163-470a-b558-25cf19ba370e",
      },
      preferredDate: "2026-10-20",
      preferredMaster: "Max",
      preferredService: "Masaż sportowy",
      preferredTimeFrom: "08:15",
      preferredTimeTo: "09:30",
      status: "active",
    };

    const parsed = parseWaitlistEntryDetails(rawEntry, []);
    expect(parsed.clientName).toBe("Olha");
    expect(parsed.clientPhone).toBe("+48452402306");
    expect(parsed.clientEmail).toBe("nuar.contact@gmail.com");
    expect(parsed.clientComment).toBe("Болит поясница");
    expect(parsed.siteBookingRequestId).toBe("6bbc321a-a163-470a-b558-25cf19ba370e");
    expect(parsed.source).toBe("site");
    expect(parsed.durationMinutes).toBe(75);
    expect(parsed.bookedPrice).toBe(310);
    expect(parsed.isActive).toBe(true);
    expect(parsed.isDeleted).toBe(false);
  });

  it("identifies deleted, booked, and offered statuses correctly", () => {
    expect(isWaitlistEntryActive({ status: "active" })).toBe(true);
    expect(isWaitlistEntryActive({ status: "offered" })).toBe(false);
    expect(isWaitlistEntryActive({ status: "booked" })).toBe(false);
    expect(isWaitlistEntryActive({ status: "deleted" })).toBe(false);
    expect(isWaitlistEntryActive({ status: "active", payload: { deletedAt: "2026-10-19T10:00:00Z" } })).toBe(false);

    expect(isWaitlistEntryDeleted({ status: "deleted" })).toBe(true);
    expect(isWaitlistEntryDeleted({ status: "active", payload: { deletedAt: "2026-10-19T10:00:00Z" } })).toBe(true);

    expect(isWaitlistEntryOffered({ status: "offered" })).toBe(true);
    expect(isWaitlistEntryCompleted({ status: "booked" })).toBe(true);
    expect(isWaitlistEntryCompleted({ status: "completed" })).toBe(true);
  });
});

