import {describe, expect, it} from "vitest";
import {
  buildDayCloseJournal,
  buildDayCloseRecord,
  calculateDayCloseVariance,
  findDayCloseRecord,
  normalizeCloseDate,
} from "./dayClose.js";

describe("dayClose", () => {
  const visits = [
    {
      amount: 300,
      client: "Anna",
      date: "12.06.2026",
      payment: "Наличные",
      recordType: "",
      status: "completed",
      time: "10:00",
    },
    {
      amount: 400,
      client: "Ewa",
      date: "12.06.2026",
      payment: "Карта",
      recordType: "",
      status: "completed",
      time: "12:00",
    },
  ];

  it("builds journal totals for selected day", () => {
    const journal = buildDayCloseJournal({
      date: "2026-06-12",
      visits,
    });

    expect(journal.cashReceived).toBe(300);
    expect(journal.cardReceived).toBe(400);
    expect(journal.receivedRevenue).toBe(700);
    expect(journal.completedVisits).toBe(2);
  });

  it("calculates cash variance with withdrawal", () => {
    expect(
      calculateDayCloseVariance({
        actualCashInDrawer: 250,
        cashWithdrawal: 50,
        journalCash: 300,
      }),
    ).toEqual({
      actual: 250,
      expectedCash: 250,
      variance: 0,
    });
  });

  it("creates close record and finds it by date", () => {
    const journal = buildDayCloseJournal({
      date: "2026-06-12",
      visits,
    });
    const record = buildDayCloseRecord({
      actualCashInDrawer: 280,
      cashWithdrawal: 20,
      date: "2026-06-12",
      id: "close-1",
      journal,
      note: "Всё ок",
    });

    expect(record.variance).toBe(0);
    expect(normalizeCloseDate(record.date)).toBe("2026-06-12");
    expect(findDayCloseRecord([record], "12.06.2026")?.id).toBe("close-1");
  });
});
