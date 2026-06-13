import {describe, expect, it} from "vitest";
import {applySiteBookingRequest} from "./applySiteBooking.js";
import {
  formatSiteBookingDateForCrm,
  formatSiteBookingTimeForCrm,
  resolveSiteBookingMaster,
  resolveSiteBookingService,
} from "./siteBooking.js";

describe("siteBooking", () => {
  const employees = [
    {id: 1, name: "Ольга", commissionRate: 35},
    {id: 2, name: "Максим", commissionRate: 40},
  ];
  const serviceCatalog = [
    {
      id: 10,
      name: "Masaż klasyczny",
      variants: [
        {duration: 60, price: 255},
        {duration: 90, price: 360},
      ],
    },
  ];

  it("maps site master aliases to CRM employees", () => {
    expect(resolveSiteBookingMaster("Olha", employees)).toBe("Ольга");
    expect(resolveSiteBookingMaster("Max", employees)).toBe("Максим");
  });

  it("resolves CRM service by slug and duration", () => {
    expect(
      resolveSiteBookingService(
        {
          duration_minutes: 60,
          service_name: "Masaż klasyczny",
          service_slug: "masaz-klasyczny",
        },
        serviceCatalog,
      ),
    ).toEqual({
      amount: 255,
      duration: 60,
      service: "Masaż klasyczny",
      serviceId: 10,
    });
  });

  it("creates calendar entry and client from site booking", () => {
    const result = applySiteBookingRequest(
      {
        id: "booking-1",
        client_email: "anna@test.pl",
        client_name: "Anna Kowalska",
        client_phone: "600123456",
        duration_minutes: 60,
        note: "Proszę o ciche pomieszczenie",
        preferred_date: "2026-06-20",
        preferred_master: "Olha",
        preferred_time: "14:30:00",
        service_name: "Masaż klasyczny",
        service_slug: "masaz-klasyczny",
      },
      {
        calendarEntries: [],
        clientProfiles: [],
        createLocalId: () => "entry-1",
        employees,
        getCalendarServiceColor: () => "#748091",
        serviceCatalog,
      },
    );

    expect(result.nextClients).toHaveLength(1);
    expect(result.nextClients[0].source).toBe("Сайт");
    expect(result.nextCalendarEntries[0].client).toBe("Anna Kowalska");
    expect(result.nextCalendarEntries[0].master).toBe("Ольга");
    expect(formatSiteBookingDateForCrm("2026-06-20")).toBe("20.06.2026");
    expect(formatSiteBookingTimeForCrm("14:30:00")).toBe("14:30");
  });
});
