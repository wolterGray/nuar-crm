import {afterEach, describe, expect, it, vi} from "vitest";
import {reportClientError} from "./auditLogs.js";

describe("reportClientError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a bounded authenticated frontend error report without URL query data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true});
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      localStorage: {getItem: () => "access-token"},
      location: {pathname: "/calendar", search: "?token=private"},
    });

    const sent = await reportClientError(new Error("Render failed"), {
      componentStack: "at CalendarPage",
    });

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/client-errors");
    expect(options.headers.Authorization).toBe("Bearer access-token");
    expect(JSON.parse(options.body)).toMatchObject({
      componentStack: "at CalendarPage",
      message: "Render failed",
      path: "/calendar",
    });
    expect(options.body).not.toContain("private");
  });
});
