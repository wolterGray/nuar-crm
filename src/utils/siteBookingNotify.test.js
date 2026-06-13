import {describe, expect, it} from "vitest";
import {formatSiteBookingOwnerMessage} from "./siteBookingNotify.js";

describe("siteBookingNotify", () => {
  it("formats owner notification message", () => {
    expect(
      formatSiteBookingOwnerMessage({
        clientName: "Anna Kowalska",
        clientPhone: "48600123456",
        clientEmail: "anna@test.pl",
        durationMinutes: 60,
        note: "Prosze o cisze",
        preferredDate: "2026-06-20",
        preferredMaster: "Olha",
        preferredTime: "14:30",
        serviceName: "Masaz klasyczny",
      }),
    ).toContain("Anna Kowalska");
    expect(
      formatSiteBookingOwnerMessage({
        clientName: "Anna Kowalska",
        clientPhone: "48600123456",
        durationMinutes: 60,
        preferredDate: "2026-06-20",
        preferredTime: "14:30",
        serviceName: "Masaz klasyczny",
      }),
    ).toContain("20.06.2026 · 14:30");
  });
});
