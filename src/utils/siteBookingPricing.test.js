import {describe, expect, it} from "vitest";
import {
  attachPricingToSlots,
  calculateSiteBookingPrice,
  getPremiumPercentForSlot,
  parseEmployeePricingFromForm,
} from "./siteBookingPricing.js";

const maxEmployee = {
  name: "Максим",
  siteDiscountPercent: 18,
  premiumHoursEnabled: false,
};

const olgaEmployee = {
  name: "Ольга",
  premiumHoursEnabled: true,
  premiumHoursRules: [
    {
      daysOfWeek: [5, 6, 0],
      enabled: true,
      endTime: "22:00",
      percent: 15,
      startTime: "17:00",
    },
  ],
  siteDiscountPercent: 0,
};

describe("calculateSiteBookingPrice", () => {
  it("applies employee discount to base price", () => {
    const pricing = calculateSiteBookingPrice({
      basePrice: 255,
      date: "2026-06-12",
      employee: maxEmployee,
      time: "12:00",
    });

    expect(pricing.subtotal).toBe(255);
    expect(pricing.discountPercent).toBe(18);
    expect(pricing.discountAmount).toBe(46);
    expect(pricing.finalPrice).toBe(209);
  });

  it("adds premium surcharge in configured hours", () => {
    const pricing = calculateSiteBookingPrice({
      basePrice: 255,
      date: "2026-06-13",
      employee: olgaEmployee,
      time: "18:00",
    });

    expect(pricing.premiumPercent).toBe(15);
    expect(pricing.premiumAmount).toBe(38);
    expect(pricing.subtotal).toBe(293);
    expect(pricing.finalPrice).toBe(293);
  });

  it("applies discount after premium surcharge", () => {
    const pricing = calculateSiteBookingPrice({
      basePrice: 255,
      date: "2026-06-13",
      employee: {
        ...maxEmployee,
        premiumHoursEnabled: true,
        premiumHoursRules: olgaEmployee.premiumHoursRules,
      },
      time: "18:00",
    });

    expect(pricing.subtotal).toBe(293);
    expect(pricing.discountPercent).toBe(18);
    expect(pricing.finalPrice).toBe(240);
  });
});

describe("getPremiumPercentForSlot", () => {
  it("returns zero outside premium window", () => {
    expect(
      getPremiumPercentForSlot(olgaEmployee, {
        date: "2026-06-12",
        time: "12:00",
      }),
    ).toBe(0);
  });
});

describe("attachPricingToSlots", () => {
  it("adds pricing fields to each slot", () => {
    const slots = attachPricingToSlots({
      date: "2026-06-13",
      durationMinutes: 60,
      employees: [maxEmployee, olgaEmployee],
      serviceCatalog: [],
      serviceName: "Classic massage",
      serviceSlug: "masaz-klasyczny",
      slots: [
        {master: "Максим", startTime: "12:00"},
        {master: "Ольга", startTime: "18:00"},
      ],
    });

    expect(slots[0].finalPrice).toBe(209);
    expect(slots[1].finalPrice).toBe(293);
  });

  it("resolves base price from slug when CRM catalog is empty", () => {
    const slots = attachPricingToSlots({
      date: "2026-06-13",
      durationMinutes: 60,
      employees: [maxEmployee],
      serviceCatalog: [],
      serviceName: "Classic massage",
      serviceSlug: "masaz-klasyczny",
      slots: [{master: "Максим", startTime: "12:00"}],
    });

    expect(slots[0].basePrice).toBe(255);
  });
});

describe("parseEmployeePricingFromForm", () => {
  it("reads employee pricing settings from form data", () => {
    const form = new FormData();
    form.set("siteDiscountPercent", "18");
    form.set("premiumHoursEnabled", "on");
    form.set("premiumHoursPercent", "20");
    form.set("premiumHoursStart", "16:00");
    form.set("premiumHoursEnd", "21:00");
    form.append("premiumHoursDays", "5");
    form.append("premiumHoursDays", "6");

    const parsed = parseEmployeePricingFromForm(form);

    expect(parsed.siteDiscountPercent).toBe(18);
    expect(parsed.premiumHoursEnabled).toBe(true);
    expect(parsed.premiumHoursRules[0].percent).toBe(20);
    expect(parsed.premiumHoursRules[0].daysOfWeek).toEqual([5, 6]);
  });
});
