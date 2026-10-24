import {describe, expect, it} from "vitest";
import {buildPaymentRows, filterPaymentRows} from "./paymentRows.js";

describe("paymentRows", () => {
  it("merges calendar-only visits with journal visits", () => {
    const rows = buildPaymentRows(
      [
        {
          id: "cal-1",
          kind: "visit",
          client: "Anna",
          date: "2026-06-11",
          time: "12:00",
          duration: 60,
          status: "scheduled",
        },
      ],
      [],
      new Date("2026-06-11T10:00:00"),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("calendar-cal-1");
  });

  it("filters rows by master", () => {
    const filtered = filterPaymentRows(
      [{master: "Ola", client: "Anna", date: "11.06.2026", payment: "Наличные"}],
      {master: "Ola", payment: "", client: "", date: ""},
    );

    expect(filtered).toHaveLength(1);
  });

  it("includes package sales as read-only income rows", () => {
    const rows = buildPaymentRows([], [], [{
      id: 7,
      client: "Magda",
      master: "Max",
      packageName: "Пакет 6 визитов",
      payment: "Карта",
      price: 990,
      purchaseDate: "2026-10-24",
    }]);

    expect(rows).toEqual([expect.objectContaining({
      amount: 990,
      client: "Magda",
      date: "24.10.2026",
      master: "Max",
      paidAmount: 990,
      payment: "Карта",
      readOnly: true,
      recordType: "package_sale",
    })]);
  });
});
