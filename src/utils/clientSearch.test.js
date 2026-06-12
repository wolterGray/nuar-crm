import {describe, expect, it} from "vitest";
import {
  buildClientSearchIndex,
  clientMatchesQuery,
  normalizeTelegramHandle,
  searchClients,
} from "./clientSearch.js";

describe("clientSearch", () => {
  const clients = [
    {
      id: 1,
      name: "Anna Kowalska",
      phone: "+48 600 123 456",
      email: "anna@example.com",
      telegram: "@anna_nuar",
    },
    {
      id: 2,
      name: "Piotr Nowak",
      phone: "500111222",
      email: "piotr@test.pl",
      telegram: "piotr_nowak",
    },
  ];

  it("matches by name, phone, email and telegram", () => {
    expect(clientMatchesQuery(clients[0], "Anna")).toBe(true);
    expect(clientMatchesQuery(clients[0], "600123")).toBe(true);
    expect(clientMatchesQuery(clients[0], "anna@example.com")).toBe(true);
    expect(clientMatchesQuery(clients[0], "@anna_nuar")).toBe(true);
    expect(clientMatchesQuery(clients[1], "piotr@test")).toBe(true);
  });

  it("ranks exact phone matches higher", () => {
    const results = searchClients({
      clients,
      query: "600123456",
    });

    expect(results[0]?.id).toBe(1);
  });

  it("builds last visit from journal and calendar", () => {
    const index = buildClientSearchIndex({
      clientProfiles: clients,
      visits: [
        {
          id: "v1",
          clientId: 1,
          client: "Anna Kowalska",
          date: "10.05.2026",
          recordType: "visit",
        },
      ],
      calendarEntries: [],
    });

    expect(index[0].lastVisit).toBe("10.05.2026");
  });

  it("normalizes telegram handles", () => {
    expect(normalizeTelegramHandle("https://t.me/anna_nuar")).toBe("anna_nuar");
    expect(normalizeTelegramHandle("@Anna")).toBe("anna");
  });
});
