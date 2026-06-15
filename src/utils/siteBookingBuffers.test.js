import {describe, expect, it} from "vitest";
import {
  extendIntervalWithServiceBuffers,
  getServiceBookingBuffers,
  normalizeSiteBookingBufferSettings,
} from "./siteBookingBuffers.js";

describe("siteBookingBuffers", () => {
  it("returns zero buffers when toggles are disabled", () => {
    expect(
      getServiceBookingBuffers({
        siteBookingBufferAfterEnabled: false,
        siteBookingBufferAfterMinutes: 30,
        siteBookingBufferBeforeEnabled: false,
        siteBookingBufferBeforeMinutes: 15,
      }),
    ).toEqual({after: 0, before: 0});
  });

  it("extends occupied interval with enabled service buffers", () => {
    const serviceCatalog = [
      {
        id: 1,
        name: "Бандаж крио",
        siteBookingBufferAfterEnabled: true,
        siteBookingBufferAfterMinutes: 30,
        siteBookingBufferBeforeEnabled: true,
        siteBookingBufferBeforeMinutes: 15,
      },
    ];

    expect(
      extendIntervalWithServiceBuffers(
        {start: 600, end: 660},
        serviceCatalog,
        {serviceId: 1, serviceName: "Бандаж крио"},
      ),
    ).toEqual({start: 585, end: 690});
  });

  it("normalizes buffer settings from service record", () => {
    expect(
      normalizeSiteBookingBufferSettings({
        siteBookingBufferAfterEnabled: true,
        siteBookingBufferAfterMinutes: 20,
      }),
    ).toEqual({
      afterEnabled: true,
      afterMinutes: 20,
      beforeEnabled: false,
      beforeMinutes: 0,
    });
  });
});
