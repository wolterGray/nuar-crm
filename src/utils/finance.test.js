import {describe, expect, it} from "vitest";
import {
  buildFinanceStats,
  getVisitReceivedAmount,
  normalizePaymentMethod,
} from "./finance.js";

const PERIOD_START = "2026-06-01";
const PERIOD_END = "2026-06-30";
const NOW = new Date("2026-06-15T12:00:00");

const employees = [{name: "Max", commissionRate: 40}];

const buildStats = (overrides = {}) =>
  buildFinanceStats({
    calendarEntries: [],
    clientPackages: [],
    employees,
    endDate: PERIOD_END,
    master: "",
    now: NOW,
    startDate: PERIOD_START,
    visits: [],
    ...overrides,
  });

const completedVisit = (overrides = {}) => ({
  amount: 500,
  commission: 0,
  commissionType: "Без комиссии",
  date: "04.06.2026",
  debt: 0,
  discount: 0,
  extra: 0,
  master: "Max",
  payment: "Наличные",
  status: "completed",
  time: "12:00",
  tip: 0,
  ...overrides,
});

describe("normalizePaymentMethod", () => {
  it("maps mono separately from ukrainian card", () => {
    expect(normalizePaymentMethod("monobank")).toBe("mono");
    expect(normalizePaymentMethod("Укр. карта")).toBe("ukrainianCard");
  });
});

describe("buildFinanceStats", () => {
  it("returns zero totals for empty data", () => {
    const stats = buildStats();

    expect(stats.grossRevenue).toBe(0);
    expect(stats.receivedRevenue).toBe(0);
    expect(stats.netProfit).toBe(0);
    expect(stats.completedAppointments).toHaveLength(0);
  });

  it("counts completed cash visit in period", () => {
    const stats = buildStats({
      visits: [completedVisit()],
    });

    expect(stats.grossRevenue).toBe(500);
    expect(stats.discountedRevenue).toBe(500);
    expect(stats.serviceReceived).toBe(500);
    expect(stats.receivedRevenue).toBe(500);
    expect(stats.cashReceived).toBe(500);
    expect(stats.employeePayouts).toBe(200);
    expect(stats.netProfit).toBe(300);
    expect(stats.completedAppointments).toHaveLength(1);
  });

  it("ignores visits outside selected period", () => {
    const stats = buildStats({
      visits: [completedVisit({date: "15.05.2026"})],
    });

    expect(stats.grossRevenue).toBe(0);
    expect(stats.completedAppointments).toHaveLength(0);
  });

  it("ignores cancelled visits in revenue", () => {
    const stats = buildStats({
      visits: [completedVisit({status: "cancelled"})],
    });

    expect(stats.grossRevenue).toBe(0);
    expect(getVisitReceivedAmount(completedVisit({status: "cancelled"}))).toBe(0);
  });

  it("tracks debt only for visits in period", () => {
    const stats = buildStats({
      visits: [
        completedVisit({debt: 200, paidAmount: 300}),
        completedVisit({date: "10.07.2026", debt: 100}),
      ],
    });

    expect(stats.debtAmount).toBe(200);
    expect(stats.debtVisits).toHaveLength(1);
    expect(stats.outstandingDebts).toBe(300);
    expect(stats.serviceReceived).toBe(300);
  });

  it("counts manual paidAmount discount in finance stats", () => {
    const stats = buildStats({
      visits: [completedVisit({amount: 400, paidAmount: 370})],
    });

    expect(stats.grossRevenue).toBe(400);
    expect(stats.discountedRevenue).toBe(370);
    expect(stats.discounts).toBe(30);
    expect(stats.serviceReceived).toBe(370);
  });

  it("filters by master", () => {
    const stats = buildStats({
      master: "Anna",
      visits: [
        completedVisit({master: "Max"}),
        completedVisit({master: "Anna", amount: 300}),
      ],
    });

    expect(stats.grossRevenue).toBe(300);
    expect(stats.completedAppointments).toHaveLength(1);
  });

  it("excludes package service amount but keeps tips", () => {
    const stats = buildStats({
      visits: [completedVisit({payment: "Пакет", tip: 50})],
    });

    expect(stats.grossRevenue).toBe(0);
    expect(stats.serviceReceived).toBe(50);
    expect(stats.tips).toBe(50);
    expect(stats.paymentsByMethod.package).toBe(50);
  });

  it("adds sold client packages to received revenue", () => {
    const stats = buildStats({
      clientPackages: [
        {
          id: "pkg-1",
          master: "Max",
          payment: "Карта",
          price: 1200,
          purchaseDate: "10.06.2026",
          totalVisits: 6,
        },
      ],
    });

    expect(stats.packageIncome).toBe(1200);
    expect(stats.receivedRevenue).toBe(1200);
    expect(stats.cardReceived).toBe(1200);
    expect(stats.packageSalePayouts).toBe(480);
    expect(stats.netProfit).toBe(720);
  });

  it("subtracts expense operations from net profit", () => {
    const stats = buildStats({
      visits: [
        completedVisit(),
        {
          amount: -150,
          date: "05.06.2026",
          extra: -150,
          master: "Max",
          payment: "Наличные",
          recordType: "operation",
          service: "Расход на расходники",
          status: "completed",
          time: "10:00",
        },
      ],
    });

    expect(stats.expenses).toBe(150);
    expect(stats.operationsIncome).toBe(0);
    expect(stats.receivedRevenue).toBe(500);
    expect(stats.netProfit).toBe(150);
  });

  it("counts certificate sale operations", () => {
    const stats = buildStats({
      visits: [
        {
          amount: 400,
          date: "06.06.2026",
          master: "Max",
          payment: "Наличные",
          recordType: "operation",
          service: "Продажа сертификата",
          status: "completed",
          time: "11:00",
        },
      ],
    });

    expect(stats.certificateIncome).toBe(400);
    expect(stats.operationsIncome).toBe(400);
    expect(stats.receivedRevenue).toBe(400);
  });

  it("builds forecast from future calendar entries in period", () => {
    const stats = buildStats({
      calendarEntries: [
        {
          amount: 300,
          date: "20.06.2026",
          discount: 0,
          extra: 0,
          kind: "visit",
          master: "Max",
          payment: "Наличные",
          status: "planned",
          time: "14:00",
          tip: 0,
        },
      ],
    });

    expect(stats.forecastVisits).toHaveLength(1);
    expect(stats.forecastRevenue).toBe(300);
  });

  it("groups mono payments separately", () => {
    const stats = buildStats({
      visits: [completedVisit({payment: "Mono", amount: 250})],
    });

    expect(stats.paymentsByMethod.mono).toBe(250);
    expect(stats.paymentsByMethod.ukrainianCard).toBe(0);
  });

  it("excludes barter from gross revenue", () => {
    const stats = buildStats({
      visits: [completedVisit({payment: "Бартер", amount: 600})],
    });

    expect(stats.grossRevenue).toBe(0);
    expect(stats.serviceReceived).toBe(0);
    expect(stats.paymentsByMethod.barter).toBe(0);
  });
});
