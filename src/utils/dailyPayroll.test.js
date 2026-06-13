import {describe, expect, it} from "vitest";
import {
  buildDailyPayrollDayReport,
  isDailyPayrollEmployee,
  isVisitMasterPayoutPaid,
  normalizePayrollSchedule,
} from "./dailyPayroll.js";

describe("dailyPayroll", () => {
  const employees = [
    {
      id: 1,
      name: "Максим",
      commissionRate: 40,
      payrollSchedule: "daily",
      status: "Активен",
    },
    {
      id: 2,
      name: "Ольга",
      commissionRate: 35,
      payrollSchedule: "monthly",
      status: "Активен",
    },
  ];

  it("detects daily payroll schedule", () => {
    expect(normalizePayrollSchedule("daily")).toBe("daily");
    expect(normalizePayrollSchedule(undefined)).toBe("monthly");
    expect(isDailyPayrollEmployee(employees[0])).toBe(true);
    expect(isDailyPayrollEmployee(employees[1])).toBe(false);
  });

  it("builds per-visit payout rows for a day", () => {
    const report = buildDailyPayrollDayReport({
      clientPackages: [
        {
          id: 10,
          master: "Максим",
          price: 1000,
          purchaseDate: "12.06.2026",
          totalVisits: 5,
        },
      ],
      date: "2026-06-12",
      employee: employees[0],
      employees,
      visits: [
        {
          id: 1,
          amount: 250,
          client: "Anna",
          date: "12.06.2026",
          master: "Максим",
          payment: "Наличные",
          service: "Masaż 60",
          status: "completed",
          time: "10:00",
        },
        {
          id: 2,
          amount: 1000,
          client: "Bartek",
          date: "12.06.2026",
          master: "Максим",
          packageSessionsUsed: 1,
          packageUsageId: 10,
          payment: "Пакет",
          service: "Pakiet",
          status: "completed",
          time: "14:00",
        },
        {
          id: 3,
          amount: 300,
          client: "Chris",
          date: "12.06.2026",
          master: "Максим",
          masterPayoutPaidAt: "2026-06-12T18:00:00.000Z",
          payment: "Карта",
          service: "Masaż 90",
          status: "completed",
          time: "16:00",
        },
      ],
    });

    expect(report.rows).toHaveLength(3);
    expect(report.rows[0].payout).toBe(100);
    expect(report.rows[1].payout).toBe(80);
    expect(report.rows[2].payout).toBe(120);
    expect(report.totals.totalPayout).toBe(300);
    expect(report.totals.paidPayout).toBe(120);
    expect(report.totals.unpaidPayout).toBe(180);
    expect(report.totals.unpaidCount).toBe(2);
    expect(isVisitMasterPayoutPaid({masterPayoutPaidAt: "2026-06-12T18:00:00.000Z"})).toBe(
      true,
    );
  });
});
