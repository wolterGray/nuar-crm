import {createRequire} from "node:module";
import {describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);
const {
  buildPackageSaleEarningSnapshot,
  cleanupPackageVisitEarningsAndEnsureSales,
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

  it("allows zero commission and falls back to 40% for missing or invalid commission", async () => {
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
    await expect(buildEmployeeEarningSnapshot(txWithCommission(null), visit).then((snapshot) => String(snapshot.commissionPercent)))
      .resolves.toBe("40");
    await expect(buildEmployeeEarningSnapshot(txWithCommission(-1), visit).then((snapshot) => String(snapshot.commissionPercent)))
      .resolves.toBe("40");
    await expect(buildEmployeeEarningSnapshot(txWithCommission(101), visit).then((snapshot) => String(snapshot.commissionPercent)))
      .resolves.toBe("40");
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

  it("keeps package sale commission separate from package visit executor commission", async () => {
    const employees = new Map([
      [7, {id: 7, commissionRate: 40, name: "Макс"}],
      [9, {id: 9, commissionRate: 20, name: "Оля"}],
    ]);
    const clientPackage = {
      id: 5,
      price: 1200,
      totalVisits: 6,
      payload: {employeeId: 9, master: "Оля", packageName: "Пакет 6"},
    };
    const tx = {
      clientPackage: {
        findUnique: async () => clientPackage,
      },
      employee: {
        findUnique: async ({where}) => employees.get(where.id) ?? null,
        findFirst: async ({where}) =>
          [...employees.values()].find((employee) => employee.name === where.name) ?? null,
      },
    };

    const saleSnapshot = await buildPackageSaleEarningSnapshot(tx, clientPackage);
    const visitSnapshot = await buildEmployeeEarningSnapshot(tx, {
      employeeId: 7,
      payload: {
        amount: 0,
        packageSessionsUsed: 1,
        packageUsageId: 5,
        paidAmount: 0,
        payment: "Пакет",
        status: "completed",
      },
    });

    expect(saleSnapshot.employeeId).toBe(9);
    expect(String(saleSnapshot.actualPrice)).toBe("1200");
    expect(String(saleSnapshot.amount)).toBe("240");
    expect(visitSnapshot.employeeId).toBe(7);
    expect(String(visitSnapshot.actualPrice)).toBe("200");
    expect(String(visitSnapshot.amount)).toBe("80");
  });

  it("pays every master in a paired massage from their own service share", async () => {
    const employees = new Map([
      [1, {id: 1, commissionRate: 40, name: "Макс"}],
      [2, {id: 2, commissionRate: 40, name: "Алена"}],
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
        amount: 500,
        paidAmount: 500,
        parallelEmployees: [
          {employeeId: 1, name: "Макс", shareAmount: 250},
          {employeeId: 2, name: "Алена", shareAmount: 250},
        ],
        payment: "Карта",
        status: "completed",
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => String(snapshot.actualPrice))).toEqual(["250", "250"]);
    expect(snapshots.map((snapshot) => String(snapshot.amount))).toEqual(["100", "100"]);
  });

  it("creates earnings for an old paired package visit without saved parallel employees", async () => {
    const employees = new Map([
      [7, {id: 7, commissionRate: 40, name: "Наташа"}],
      [8, {id: 8, commissionRate: 40, name: "Алена"}],
    ]);
    const tx = {
      clientPackage: {
        findUnique: async () => ({id: 12, price: 1200, totalVisits: 6, payload: {}}),
      },
      employee: {
        findMany: async () => [...employees.values()],
        findFirst: async ({where}) => {
          const name = typeof where?.name === "string" ? where.name : where?.name?.equals;
          return [...employees.values()].find((employee) => employee.name === name) ?? null;
        },
        findUnique: async ({where}) => employees.get(where.id) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      employeeId: 7,
      payload: {
        amount: 600,
        master: "Наташа",
        packageSessionsUsed: 1,
        packageUsageId: 12,
        paidAmount: 0,
        payment: "Пакет",
        service: "Masaż dla dwojga",
        status: "completed",
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.employeeId)).toEqual([7, 8]);
    expect(snapshots.map((snapshot) => String(snapshot.actualPrice))).toEqual(["100", "100"]);
    expect(snapshots.map((snapshot) => String(snapshot.amount))).toEqual(["40", "40"]);
  });

  it("detects an old paired package visit from service payload and package usage fields", async () => {
    const employees = new Map([
      [7, {id: 7, commissionRate: 40, name: "Наталья"}],
      [8, {id: 8, commissionRate: 40, name: "Макс"}],
    ]);
    const tx = {
      clientPackage: {
        findUnique: async () => ({id: 12, price: 1200, totalVisits: 6, payload: {}}),
      },
      employee: {
        findMany: async () => [...employees.values()],
        findFirst: async ({where}) => {
          const name = typeof where?.name === "string" ? where.name : where?.name?.equals;
          return [...employees.values()].find((employee) => employee.name === name) ?? null;
        },
        findUnique: async ({where}) => employees.get(where.id) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      employeeId: 7,
      payload: {
        amount: 600,
        packageSessionsUsed: 1,
        packageUsageId: 12,
        paidAmount: 0,
        status: "completed",
      },
      service: {
        name: "Masaż",
        payload: {
          isParallel: true,
          parallelParticipants: 2,
        },
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.employeeId)).toEqual([7, 8]);
    expect(snapshots.map((snapshot) => String(snapshot.amount))).toEqual(["40", "40"]);
  });

  it("creates earnings for an old cash paired visit from service payload", async () => {
    const employees = new Map([
      [7, {id: 7, commissionRate: 40, name: "Наталья"}],
      [8, {id: 8, commissionRate: 40, name: "Макс"}],
    ]);
    const tx = {
      employee: {
        findMany: async () => [...employees.values()],
        findFirst: async ({where}) => {
          const name = typeof where?.name === "string" ? where.name : where?.name?.equals;
          return [...employees.values()].find((employee) => employee.name === name) ?? null;
        },
        findUnique: async ({where}) => employees.get(where.id) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      employeeId: 7,
      payload: {
        amount: 600,
        paidAmount: 600,
        payment: "Наличные",
        status: "completed",
      },
      service: {
        name: "Masaż",
        payload: {
          isParallel: true,
          parallelParticipants: 2,
        },
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.employeeId)).toEqual([7, 8]);
    expect(snapshots.map((snapshot) => String(snapshot.actualPrice))).toEqual(["300", "300"]);
    expect(snapshots.map((snapshot) => String(snapshot.amount))).toEqual(["120", "120"]);
  });

  it("pairs an old cash Natali visit with Max when the second master was not saved", async () => {
    const employees = new Map([
      [7, {id: 7, commissionRate: 40, name: "Natali"}],
      [8, {id: 8, commissionRate: 40, name: "Max"}],
      [9, {id: 9, commissionRate: 40, name: "Алена"}],
    ]);
    const tx = {
      employee: {
        findMany: async () => [...employees.values()],
        findFirst: async ({where}) => {
          const name = typeof where?.name === "string" ? where.name : where?.name?.equals;
          return [...employees.values()].find((employee) => employee.name === name) ?? null;
        },
        findUnique: async ({where}) => employees.get(where.id) ?? null,
      },
    };

    const snapshots = await buildEmployeeEarningSnapshots(tx, {
      employeeId: 7,
      payload: {
        amount: 600,
        master: "Natali",
        paidAmount: 600,
        payment: "Наличные",
        service: "Masaż dla dwojga",
        status: "completed",
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.employeeId)).toEqual([7, 8]);
    expect(snapshots.map((snapshot) => String(snapshot.actualPrice))).toEqual(["300", "300"]);
    expect(snapshots.map((snapshot) => String(snapshot.amount))).toEqual(["120", "120"]);
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

  it("does not fail cleanup when an already paid old earning conflicts", async () => {
    const created = [];
    const tx = {
      auditLog: {create: async () => ({})},
      clientPackage: {
        findMany: async () => [],
      },
      employeeEarning: {
        create: async ({data}) => {
          const earning = {id: 101, payoutId: null, ...data};
          created.push(earning);
          return earning;
        },
        findMany: async () => [
          {
            actualPrice: 600,
            amount: 240,
            commissionPercent: 40,
            employeeId: 1,
            id: 100,
            payoutId: 9,
          },
        ],
        update: async ({data, where}) => ({id: where.id, payoutId: 9, ...data}),
      },
      employee: {
        findFirst: async ({where}) => {
          const name = typeof where?.name === "string" ? where.name : where?.name?.equals;
          if (name === "Наталья") return {id: 1, commissionRate: 40, name: "Наталья"};
          if (name === "Макс") return {id: 2, commissionRate: 40, name: "Макс"};
          return null;
        },
        findUnique: async ({where}) =>
          where.id === 1
            ? {id: 1, commissionRate: 40, name: "Наталья"}
            : {id: 2, commissionRate: 40, name: "Макс"},
      },
      visit: {
        findMany: async () => [
          {
            id: 55,
            employeeEarnings: [{employeeId: 1, payoutId: 9}],
            payload: {
              amount: 600,
              date: "2026-08-06",
              master: "Наталья",
              parallelEmployees: [{name: "Наталья"}, {name: "Макс"}],
              payment: "Наличные",
              status: "completed",
            },
          },
        ],
      },
    };

    await expect(cleanupPackageVisitEarningsAndEnsureSales(tx)).resolves.toBeUndefined();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({employeeId: 2, visitId: 55});
  });

  it("does not resync completed visits that already have enough earnings", async () => {
    const tx = {
      clientPackage: {
        findMany: async () => [],
      },
      employeeEarning: {
        findMany: async () => {
          throw new Error("sync should not run");
        },
      },
      visit: {
        findMany: async () => [
          {
            id: 56,
            employeeEarnings: [{employeeId: 1, payoutId: null}],
            payload: {
              amount: 300,
              date: "2026-09-26",
              master: "Natali",
              payment: "Наличные",
              status: "completed",
            },
          },
        ],
      },
    };

    await expect(cleanupPackageVisitEarningsAndEnsureSales(tx)).resolves.toBeUndefined();
  });
});
