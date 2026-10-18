import {describe, expect, it, vi} from "vitest";
import {collectNotificationEventPages} from "./notificationEvents.js";

describe("collectNotificationEventPages", () => {
  it("loads every page so visible data can match the counts endpoint", async () => {
    const source = Array.from({length: 125}, (_, index) => ({id: index + 1}));
    const fetchPage = vi.fn(({limit, offset}) =>
      Promise.resolve(source.slice(offset, offset + limit)),
    );

    const result = await collectNotificationEventPages(fetchPage, {pageSize: 40});

    expect(result).toHaveLength(125);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(fetchPage.mock.calls.map(([request]) => request.offset)).toEqual([0, 40, 80, 120]);
  });

  it("respects the explicit safety limit", async () => {
    const fetchPage = vi.fn(({limit, offset}) =>
      Promise.resolve(Array.from({length: limit}, (_, index) => ({id: offset + index}))),
    );

    const result = await collectNotificationEventPages(fetchPage, {
      maxItems: 90,
      pageSize: 40,
    });

    expect(result).toHaveLength(90);
    expect(fetchPage.mock.calls.at(-1)[0]).toMatchObject({limit: 10, offset: 80});
  });
});
