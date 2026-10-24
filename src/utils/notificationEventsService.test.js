import {createRequire} from "node:module";
import {describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);
const {
  autoResolveExpiredAndStaleNotificationEvents,
  filterEventsByRole,
  listNotificationEvents,
} = require("../../backend/services/notificationEventsService.js");

describe("notification events service", () => {
  it("auto-resolves deprecated types and expired 48h visit events", async () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const resolvedIds = [];

    const mockEvents = [
      {id: 1, type: "visit_upcoming", status: "new", createdAt: now}, // deprecated type
      {id: 2, type: "client_inactive", status: "new", createdAt: now}, // deprecated type
      {
        id: 3,
        type: "visit_created",
        status: "new",
        createdAt: new Date(now.getTime() - 50 * 3600 * 1000), // > 48h
      },
      {
        id: 4,
        type: "visit_created",
        status: "new",
        createdAt: new Date(now.getTime() - 2 * 3600 * 1000), // recent, should stay
      },
    ];

    const prisma = {
      notificationEvent: {
        findMany: async ({where}) => {
          if (where?.type?.notIn) {
            return mockEvents.filter((e) => ["visit_upcoming", "client_inactive"].includes(e.type));
          }
          if (where?.type?.in && where?.createdAt?.lt) {
            return mockEvents.filter((e) => e.id === 3);
          }
          return [];
        },
        updateMany: async ({where}) => {
          if (where?.id?.in) {
            resolvedIds.push(...where.id.in);
            return {count: where.id.in.length};
          }
          return {count: 0};
        },
      },
      notificationRecipient: {
        updateMany: async () => ({count: 0}),
      },
      supply: {
        findMany: async () => [],
      },
      waitlistEntry: {
        findMany: async () => [],
      },
    };

    await autoResolveExpiredAndStaleNotificationEvents(prisma, now);

    expect(resolvedIds).toContain(1);
    expect(resolvedIds).toContain(2);
    expect(resolvedIds).toContain(3);
    expect(resolvedIds).not.toContain(4);
  });

  it("filters events strictly by role: owner gets everything, staff gets only assigned visits", () => {
    const events = [
      {id: 1, type: "supply_low_stock", payload: {}},
      {id: 2, type: "visit_created", payload: {employeeId: 10}},
      {id: 3, type: "visit_created", payload: {employeeId: 20}},
      {id: 4, type: "site_booking_request", payload: {preferredMasterId: 10}},
    ];

    const ownerUser = {id: 1, role: "owner"};
    const adminUser = {id: 2, role: "admin"};
    const staffUser10 = {id: 3, role: "staff", employeeId: 10};

    expect(filterEventsByRole(events, ownerUser)).toHaveLength(4);
    expect(filterEventsByRole(events, adminUser)).toHaveLength(4);

    const staffEvents = filterEventsByRole(events, staffUser10);
    // Staff should not see supplies, only events where employeeId or preferredMasterId === 10
    expect(staffEvents.map((e) => e.id)).toEqual([2, 4]);
  });

  it("lists active notification events with proper limit", async () => {
    const prisma = {
      notificationEvent: {
        findMany: async () => [
          {id: 1, type: "site_booking_request", status: "new"},
        ],
        updateMany: async () => ({count: 0}),
      },
      notificationRecipient: {
        updateMany: async () => ({count: 0}),
      },
      supply: {
        findMany: async () => [],
      },
      waitlistEntry: {
        findMany: async () => [],
      },
    };

    const listed = await listNotificationEvents(prisma, {limit: 5});
    expect(listed).toHaveLength(1);
    expect(listed[0].type).toBe("site_booking_request");
  });
});
