import {afterEach, describe, expect, it, vi} from "vitest";
import {createCalendarEntry} from "./visits.js";

describe("createCalendarEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends and reuses an idempotency key for an immediate identical retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({data: {id: 42}, success: true}),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    const payload = {date: "2026-11-05", kind: "visit", master: "Olha", time: "09:00"};

    await createCalendarEntry(payload);
    await createCalendarEntry({...payload});

    const firstHeaders = fetchMock.mock.calls[0][1].headers;
    const secondHeaders = fetchMock.mock.calls[1][1].headers;
    expect(firstHeaders["Idempotency-Key"]).toBeTruthy();
    expect(secondHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
  });
});
