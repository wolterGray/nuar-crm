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
});
