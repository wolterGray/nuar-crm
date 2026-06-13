import {describe, expect, it} from "vitest";
import {
  buildPayrollPeriodKey,
  buildPayrollRecord,
  buildPayrollReport,
  findPayrollRecord,
  getCurrentMonthPayrollRange,
} from "./payroll.js";

describe("payroll", () => {
  const employees = [
    {id: 1, name: "Max", commissionRate: 40, status: "Активен"},
    {id: 2, name: "Ola", commissionRate: 35, status: "Активен"},
  ];

  it("builds payroll rows for completed visits and package sales", () => {
    const report = buildPayrollReport({
      clientPackages: [
        {
          id: 10,
          master: "Max",
          price: 1000,
          purchaseDate: "05.06.2026",
          totalVisits: 5,
        },
      ],
      employees,
      endDate: "2026-06-30",
      startDate: "2026-06-01",
      visits: [
        {
          amount: 500,
          date: "04.06.2026",
          master: "Max",
          payment: "Наличные",
          status: "completed",
          time: "12:00",
        },
        {
          amount: 1000,
          date: "05.06.2026",
          master: "Max",
          packageSessionsUsed: 1,
          packageUsageId: 10,
          payment: "Пакет",
          status: "completed",
          time: "14:00",
        },
      ],
    });

    expect(report.employees).toHaveLength(1);
    expect(report.employees[0].employeeName).toBe("Max");
    expect(report.employees[0].servicePayout).toBe(200);
    expect(report.employees[0].packageVisitPayout).toBe(80);
    expect(report.employees[0].packageSalePayout).toBe(400);
    expect(report.totals.totalPayout).toBe(680);
  });

  it("creates and finds payroll record by period key", () => {
    const report = buildPayrollReport({
      employees,
      endDate: "2026-06-30",
      startDate: "2026-06-01",
      visits: [],
    });
    const record = buildPayrollRecord({
      endDate: "2026-06-30",
      id: "payroll-1",
      report,
      startDate: "2026-06-01",
    });

    expect(record.periodKey).toBe(buildPayrollPeriodKey("2026-06-01", "2026-06-30"));
    expect(findPayrollRecord([record], "2026-06-01", "2026-06-30")?.id).toBe(
      "payroll-1",
    );
  });

  it("returns current month range", () => {
    const range = getCurrentMonthPayrollRange(new Date("2026-06-15"));

    expect(range.startDate).toBe("2026-06-01");
    expect(range.endDate).toBe("2026-06-30");
  });
});
