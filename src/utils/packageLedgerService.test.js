import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  applyClientPackageUsage,
  restoreClientPackageUsage,
} = require("../../backend/services/packageLedgerService.js");

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeTx = ({ packages = [], usages = [] } = {}) => {
  const packageMap = new Map(packages.map((item) => [item.id, clone(item)]));
  const usageMap = new Map(usages.map((item) => [item.id, clone(item)]));
  let nextUsageId = 1000;

  const findUsageByComposite = ({ clientPackageId, visitId }) =>
    [...usageMap.values()].find(
      (item) =>
        Number(item.clientPackageId) === Number(clientPackageId) &&
        Number(item.visitId) === Number(visitId),
    ) ?? null;

  const applyData = (record, data) => {
    const next = { ...record };

    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.prototype.hasOwnProperty.call(value, "decrement")
      ) {
        next[key] = Number(next[key] || 0) - Number(value.decrement || 0);
      } else {
        next[key] = clone(value);
      }
    }

    return next;
  };

  return {
    __packages: packageMap,
    __usages: usageMap,
    auditLog: { create: async () => ({}) },
    errorEvent: { create: async () => ({}) },
    clientPackage: {
      findUnique: async ({ where }) => packageMap.get(where.id) ?? null,
      update: async ({ where, data }) => {
        const current = packageMap.get(where.id);
        const next = applyData(current, data);
        packageMap.set(where.id, next);
        return next;
      },
      updateMany: async ({ where, data }) => {
        const current = packageMap.get(where.id);
        if (!current) return { count: 0 };
        const minimum = where.remainingVisits?.gte;
        if (minimum !== undefined && Number(current.remainingVisits || 0) < Number(minimum)) {
          return { count: 0 };
        }
        packageMap.set(where.id, applyData(current, data));
        return { count: 1 };
      },
    },
    clientPackageUsage: {
      create: async ({ data }) => {
        const next = { id: nextUsageId, revertedAt: null, ...clone(data) };
        nextUsageId += 1;
        usageMap.set(next.id, next);
        return next;
      },
      findUnique: async ({ where }) => {
        if (where.id) return usageMap.get(where.id) ?? null;
        return findUsageByComposite(where.clientPackageId_visitId);
      },
      update: async ({ where, data }) => {
        const current = usageMap.get(where.id);
        const next = { ...current, ...clone(data) };
        usageMap.set(where.id, next);
        return next;
      },
    },
  };
};

describe("package ledger service", () => {
  it("deducts a package visit once and makes repeated apply idempotent", async () => {
    const tx = makeTx({
      packages: [
        {
          id: 10,
          payload: { remainingVisits: 3, status: "Активен", totalVisits: 6 },
          remainingVisits: 3,
          status: "Активен",
          totalVisits: 6,
          writeOffHistory: [],
        },
      ],
    });
    const payload = { packageSessionsUsed: 1, packageUsageId: 10 };

    const first = await applyClientPackageUsage(tx, {}, 77, payload, {
      calendarEntryId: 501,
      reason: "calendar-complete",
    });
    const second = await applyClientPackageUsage(tx, {}, 77, payload, {
      calendarEntryId: 501,
      reason: "calendar-complete-idempotent",
    });

    expect(tx.__packages.get(10).remainingVisits).toBe(2);
    expect(tx.__packages.get(10).writeOffHistory).toHaveLength(1);
    expect(tx.__packages.get(10).writeOffHistory[0]).toMatchObject({
      sessionsUsed: 1,
      visitId: 77,
    });
    expect(first.clientPackageUsage.id).toBe(second.clientPackageUsage.id);
    expect(second.idempotent).toBe(true);
  });

  it("restores usage once without increasing the package above total visits", async () => {
    const tx = makeTx({
      packages: [
        {
          id: 10,
          payload: {
            remainingVisits: 5,
            status: "Активен",
            totalVisits: 6,
            writeOffHistory: [{ sessionsUsed: 2, visitId: 77 }],
          },
          remainingVisits: 5,
          status: "Активен",
          totalVisits: 6,
          writeOffHistory: [{ sessionsUsed: 2, visitId: 77 }],
        },
      ],
      usages: [{ id: 900, clientPackageId: 10, sessionsUsed: 2, visitId: 77 }],
    });

    await restoreClientPackageUsage(tx, {}, { id: 77, payload: {} }, tx.__usages.get(900));
    await restoreClientPackageUsage(tx, {}, { id: 77, payload: {} }, tx.__usages.get(900));

    expect(tx.__packages.get(10).remainingVisits).toBe(6);
    expect(tx.__packages.get(10).writeOffHistory).toEqual([]);
    expect(tx.__usages.get(900).revertedAt).toBeTruthy();
  });

  it("moves usage from one package to another during completed visit edit", async () => {
    const tx = makeTx({
      packages: [
        {
          id: 10,
          payload: { remainingVisits: 2, status: "Активен", totalVisits: 6 },
          remainingVisits: 2,
          status: "Активен",
          totalVisits: 6,
          writeOffHistory: [{ sessionsUsed: 1, visitId: 77 }],
        },
        {
          id: 11,
          payload: { remainingVisits: 4, status: "Активен", totalVisits: 6 },
          remainingVisits: 4,
          status: "Активен",
          totalVisits: 6,
          writeOffHistory: [],
        },
      ],
      usages: [{ id: 900, clientPackageId: 10, sessionsUsed: 1, visitId: 77 }],
    });

    await restoreClientPackageUsage(tx, {}, { id: 77, payload: {} }, tx.__usages.get(900));
    await applyClientPackageUsage(
      tx,
      {},
      77,
      { packageSessionsUsed: 1, packageUsageId: 11 },
      { calendarEntryId: 501, reason: "update-completed" },
    );

    expect(tx.__packages.get(10).remainingVisits).toBe(3);
    expect(tx.__packages.get(10).writeOffHistory).toEqual([]);
    expect(tx.__packages.get(11).remainingVisits).toBe(3);
    expect(tx.__packages.get(11).writeOffHistory).toHaveLength(1);
  });
});
