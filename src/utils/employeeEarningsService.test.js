import {createRequire} from "node:module";
import {describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);
const {
  buildPackageSaleEarningSnapshot,
  buildEmployeeEarningSnapshots,
  buildEmployeeEarningSnapshot,
  calculateEmployeeAmount,
  getActualPriceForEarning,
} = require("../../backend/services/employeeEarningsService.js");
const {
  buildEmployeeEarningsSummaryRows,
  parseEarningIds,
  validateDateRange,
} = require("../../backend/routes/employeePayouts.js")._private;

describe("employee earning calculations", () => {
  it("calculates 360 zł × 40% = 144 zł with Decimal math", () => {
    expect(String(calculateEmployeeAmount(360, 40))).toBe("144");
  });

  it("uses the actual paid amount instead of the standard service amount", () => {
    expect(String(getActualPriceForEarning({
      amount: 450,
      paidAmount: 360,
      payment: "Карта",
      status: "completed",
    }))).toBe("360");
  });

  it("treats paidAmount = 0 as an explicit actual price", () => {
    expect(String(getActualPriceForEarning({
      amount: 450,
      paidAmount: 0,
      payment: "Карта",
      status: "completed",
    }))).toBe("0");
  });

  it("does not create a snapshot for cancelled or no-show visits", async () => {
    const tx = {
      employee: {
        findUnique: async () => ({id: 1, commissionRate: 40, name: "Макс"}),
      },
    };

    await expect(buildEmployeeEarningSnapshot(tx, {
      employeeId: 1,
      payload: {amount: 360, status: "cancelled"},
    })).resolves.toBeNull();
    await expect(buildEmployeeEarningSnapshot(tx, {
      employeeId: 1,
      payload: {amount: 360, status: "no_show"},
    })).resolves.toBeNull();
  });

  it("stores the commission snapshot from the employee at visit completion time", async () => {
    const tx = {
      employee: {
        findUnique: async () => ({id: 7, commissionRate: 40, name: "Макс"}),
      },
    };

    const snapshot = await buildEmployeeEarningSnapshot(tx, {
      employeeId: 7,
      payload: {
        amount: 450,
        paidAmount: 360,
        status: "completed",
      },
    });

    expect(snapshot.employeeId).toBe(7);
    expect(String(snapshot.actualPrice)).toBe("360");
    expect(String(snapshot.commissionPercent)).toBe("40");
    expect(String(snapshot.amount)).toBe("144");
  });

  it("pays package visit executor from package unit price even when visit paidAmount is 0", async () => {
    const tx = {
      clientPackage: {
        findUnique: async () => ({id: 12, price: 1200, totalVisits: 6, payload: {master: "Оля"}}),
      },
      employee: {
        findUnique: async () => ({id: 7, commissionRate: 40, name: "Макс"}),
      },
    };

    const snapshot = await buildEmployeeEarningSnapshot(tx, {
      employeeId: 7,
      payload: {
        amount: 300,
        packageSessionsUsed: 1,
        packageUsageId: 12,
        paidAmount: 0,
        payment: "Пакет",
        status: "completed",
      },
    });

    expect(snapshot.employeeId).toBe(7);
    expect(String(snapshot.actualPrice)).toBe("200");
    expect(String(snapshot.commissionPercent)).toBe("40");
    expect(String(snapshot.amount)).toBe("80");
  });

  it("splits a parallel visit actual price and pays every assigned employee by own rate", async () => {
    const employees = new Map([
      [1, {id: 1, commissionRate: 40, name: "Макс"}],
      [2, {id: 2, commissionRate: 20, name: "Алена"}],
    ]);
    const tx = {
      employee: {
        findUnique: async ({where}) => employees.get(where.id) ?? null,
        findFirst: async ({where}) =>
          [...employees.values()].find((employee) => employee.name === where.name) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      payload: {
        amount: 600,
        paidAmount: 480,
        parallelEmployees: [
          {employeeId: 1, name: "Макс"},
          {employeeId: 2, name: "Алена"},
        ],
        payment: "Карта",
        status: "completed",
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(String(snapshots[0].actualPrice)).toBe("240");
    expect(String(snapshots[0].amount)).toBe("96");
    expect(String(snapshots[1].actualPrice)).toBe("240");
    expect(String(snapshots[1].amount)).toBe("48");
  });

  it("uses parallel service line prices as proportional earning shares", async () => {
    const employees = new Map([
      [1, {id: 1, commissionRate: 40, name: "Макс"}],
      [2, {id: 2, commissionRate: 20, name: "Алена"}],
    ]);
    const tx = {
      employee: {
        findUnique: async ({where}) => employees.get(where.id) ?? null,
        findFirst: async ({where}) =>
          [...employees.values()].find((employee) => employee.name === where.name) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      payload: {
        amount: 600,
        paidAmount: 480,
        parallelEmployees: [
          {employeeId: 1, name: "Макс", shareAmount: 250},
          {employeeId: 2, name: "Алена", shareAmount: 350},
        ],
        payment: "Карта",
        status: "completed",
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(String(snapshots[0].actualPrice)).toBe("200");
    expect(String(snapshots[0].amount)).toBe("80");
    expect(String(snapshots[1].actualPrice)).toBe("280");
    expect(String(snapshots[1].amount)).toBe("56");
  });

  it("keeps old snapshot at 40% while new completed visits use changed 45% commission", async () => {
    let commissionRate = 40;
    const tx = {
      employee: {
        findUnique: async () => ({id: 7, commissionRate, name: "Макс"}),
      },
    };
    const visit = {
      employeeId: 7,
      payload: {
        amount: 300,
        paidAmount: 300,
        status: "completed",
      },
    };

    const oldSnapshot = await buildEmployeeEarningSnapshot(tx, visit);
    commissionRate = 45;
    const newSnapshot = await buildEmployeeEarningSnapshot(tx, visit);

    expect(String(oldSnapshot.commissionPercent)).toBe("40");
    expect(String(oldSnapshot.amount)).toBe("120");
    expect(String(newSnapshot.commissionPercent)).toBe("45");
    expect(String(newSnapshot.amount)).toBe("135");
  });

  it("allows a zero commission but rejects missing, negative, and >100 commission", async () => {
    const txWithCommission = (commissionRate) => ({
      employee: {
        findUnique: async () => ({id: 7, commissionRate, name: "Макс"}),
      },
    });
    const visit = {
      employeeId: 7,
      payload: {amount: 360, status: "completed"},
    };

    await expect(buildEmployeeEarningSnapshot(txWithCommission(0), visit))
      .resolves.toMatchObject({employeeId: 7});
    await expect(buildEmployeeEarningSnapshot(txWithCommission(null), visit))
      .rejects.toThrow("Commission percent is not set");
    await expect(buildEmployeeEarningSnapshot(txWithCommission(-1), visit))
      .rejects.toThrow("must be between 0 and 100");
    await expect(buildEmployeeEarningSnapshot(txWithCommission(101), visit))
      .rejects.toThrow("must be between 0 and 100");
  });

  it("creates package sale snapshot from employee commissionRate", async () => {
    const tx = {
      employee: {
        findFirst: async () => ({id: 9, commissionRate: 20, name: "Алена"}),
      },
    };

    const snapshot = await buildPackageSaleEarningSnapshot(tx, {
      id: 5,
      price: 300,
      payload: {master: "Алена"},
    });

    expect(snapshot.employeeId).toBe(9);
    expect(String(snapshot.actualPrice)).toBe("300");
    expect(String(snapshot.commissionPercent)).toBe("20");
    expect(String(snapshot.amount)).toBe("60");
  });

  it("skips package sale snapshot when seller is not selected", async () => {
    const tx = {
      employee: {
        findFirst: async () => null,
      },
    };

    await expect(buildPackageSaleEarningSnapshot(tx, {
      id: 5,
      price: 300,
      payload: {},
    })).resolves.toBeNull();
  });
});

describe("employee payout validation and summaries", () => {
  it("rejects duplicate earningIds instead of silently deduping", () => {
    expect(() => parseEarningIds([1, 1, 2])).toThrow("must not contain duplicates");
  });

  it("validates date ranges", () => {
    expect(() => validateDateRange("2026-08-14", "2026-08-13")).toThrow("startDate");
    expect(() => validateDateRange("bad", "2026-08-13")).toThrow("YYYY-MM-DD");
    expect(() => validateDateRange("2026-08-13", "2026-08-13")).not.toThrow();
  });

  it("keeps previous-period unpaid debt visible when filtering current period", () => {
    const rows = buildEmployeeEarningsSummaryRows({
      employees: [{id: 1, name: "Макс"}],
      startDate: "2026-08-10",
      endDate: "2026-08-16",
      earnings: [
        {
          amount: 300,
          employeeId: 1,
          payoutId: null,
          visit: {payload: {date: "2026-08-06"}},
        },
        {
          amount: 800,
          employeeId: 1,
          payoutId: null,
          visit: {payload: {date: "2026-08-13"}},
        },
      ],
    });

    expect(rows[0].earned).toBe("800");
    expect(rows[0].unpaid).toBe("1100");
    expect(rows[0].unpaidCount).toBe(2);
  });

  it("counts package sale earnings by purchase date", () => {
    const rows = buildEmployeeEarningsSummaryRows({
      employees: [{id: 1, name: "Алена"}],
      startDate: "2026-08-10",
      endDate: "2026-08-16",
      earnings: [
        {
          amount: 60,
          clientPackage: {purchaseDate: "13.08.2026", payload: {master: "Алена"}},
          employeeId: 1,
          payoutId: null,
          sourceType: "PACKAGE_SALE",
        },
      ],
    });

    expect(rows[0].earned).toBe("60");
    expect(rows[0].unpaid).toBe("60");
    expect(rows[0].visitsCount).toBe(1);
  });

  it("does not count cancelled payouts as paid", () => {
    const rows = buildEmployeeEarningsSummaryRows({
      employees: [{id: 1, name: "Макс"}],
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      earnings: [
        {
          amount: 144,
          employeeId: 1,
          payoutId: 9,
          payout: {status: "CANCELLED"},
          visit: {payload: {date: "13.08.2026"}},
        },
        {
          amount: 180,
          employeeId: 1,
          payoutId: 10,
          payout: {status: "PAID"},
          visit: {payload: {date: "2026-08-14"}},
        },
      ],
    });

    expect(rows[0].paid).toBe("180");
    expect(rows[0].unpaid).toBe("144");
  });
});
