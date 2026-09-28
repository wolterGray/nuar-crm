import {createRequire} from "node:module";
import {describe, expect, it} from "vitest";

const require = createRequire(import.meta.url);
const {
  listNotificationEvents,
  _private: {
    isActionableVisitUpcomingEvent,
    isStaleVisitUpcomingEvent,
    resolveStaleVisitUpcomingEvents,
  },
} = require("../../backend/services/notificationEventsService.js");

const toInputDate = (date) => [
  String(date.getFullYear()).padStart(4, "0"),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const toTime = (date) => [
  String(date.getHours()).padStart(2, "0"),
  String(date.getMinutes()).padStart(2, "0"),
].join(":");

describe("notification events service", () => {
  it("treats past upcoming visit notifications as stale", () => {
    const now = new Date("2026-09-28T12:00:00");

    expect(
      isStaleVisitUpcomingEvent(
        {
          payload: {date: "2026-08-28", time: "16:00"},
          type: "visit_upcoming",
        },
        null,
        now,
      ),
    ).toBe(true);
  });

  it("treats today's visit notification as stale after the grace window", () => {
    const now = new Date("2026-09-28T12:00:00");

    expect(
      isStaleVisitUpcomingEvent(
        {
          payload: {date: "2026-09-28", time: "11:00"},
          type: "visit_upcoming",
        },
        null,
        now,
      ),
    ).toBe(true);
  });

  it("keeps a future visit notification active", () => {
    const now = new Date("2026-09-28T12:00:00");

    expect(
      isStaleVisitUpcomingEvent(
        {
          payload: {date: "2026-09-28", time: "13:00"},
          type: "visit_upcoming",
        },
        null,
        now,
      ),
    ).toBe(false);
  });

  it("shows only upcoming visit notifications inside the near horizon", () => {
    const now = new Date("2026-09-28T12:00:00");

    expect(
      isActionableVisitUpcomingEvent(
        {
          payload: {date: "2026-09-28", time: "13:00"},
          type: "visit_upcoming",
        },
        null,
        now,
      ),
    ).toBe(true);
    expect(
      isActionableVisitUpcomingEvent(
        {
          payload: {date: "2026-09-29", time: "10:00"},
          type: "visit_upcoming",
        },
        null,
        now,
      ),
    ).toBe(false);
  });

  it("resolves stale visit notifications before listing active events", async () => {
    const now = new Date();
    const yesterday = toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const today = toInputDate(now);
    const nearTime = toTime(new Date(now.getTime() + 60 * 60 * 1000));
    const updatedIds = [];
    const events = [
      {
        id: 1,
        entityId: "10",
        payload: {date: yesterday, time: "16:00"},
        status: "new",
        type: "visit_upcoming",
      },
      {
        id: 2,
        entityId: "11",
        payload: {date: today, time: nearTime},
        status: "new",
        type: "visit_upcoming",
      },
    ];
    const prisma = {
      calendarEntry: {
        findMany: async () => [],
      },
      notificationEvent: {
        findMany: async ({where}) => {
          if (where?.type === "visit_upcoming") return events;
          return events.filter((event) => !updatedIds.includes(event.id));
        },
        updateMany: async ({where}) => {
          updatedIds.push(...where.id.in);
          return {count: where.id.in.length};
        },
      },
    };

    const listed = await listNotificationEvents(prisma, {
      limit: 10,
      status: "active",
    });

    expect(updatedIds).toEqual([1]);
    expect(listed.map((event) => event.id)).toEqual([2]);
  });

  it("can run stale cleanup directly", async () => {
    const prisma = {
      calendarEntry: {
        findMany: async () => [],
      },
      notificationEvent: {
        findMany: async () => [
          {
            id: 3,
            payload: {date: "2026-08-28", time: "16:00"},
            status: "seen",
            type: "visit_upcoming",
          },
        ],
        updateMany: async ({where}) => ({count: where.id.in.length}),
      },
    };

    await expect(
      resolveStaleVisitUpcomingEvents(prisma, {
        now: new Date("2026-09-28T12:00:00"),
      }),
    ).resolves.toBe(1);
  });
});
