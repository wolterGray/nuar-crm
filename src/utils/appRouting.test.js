import {describe, expect, it} from "vitest";
import {
  getPageFromPath,
  getPathFromPage,
  isSupportedAppPath,
  normalizeAppPath,
  resolveInitialPage,
} from "./appRouting.js";

describe("appRouting", () => {
  it("maps pages to paths and back", () => {
    expect(getPathFromPage("today")).toBe("/today");
    expect(getPageFromPath("/clients")).toBe("clients");
    expect(getPageFromPath("/unknown")).toBe(null);
  });

  it("normalizes root path", () => {
    expect(normalizeAppPath("/")).toBe("/");
    expect(normalizeAppPath("/calendar/")).toBe("/calendar");
  });

  it("prefers url page over stored page", () => {
    expect(
      resolveInitialPage({
        pathname: "/operations",
        storedPage: "calendar",
      }),
    ).toBe("operations");
    expect(
      resolveInitialPage({
        pathname: "/",
        storedPage: "today",
      }),
    ).toBe("today");
  });

  it("accepts known CRM paths for AppGate", () => {
    expect(isSupportedAppPath("/")).toBe(true);
    expect(isSupportedAppPath("/reset-password")).toBe(true);
    expect(isSupportedAppPath("/today")).toBe(true);
    expect(isSupportedAppPath("/calendar")).toBe(true);
    expect(isSupportedAppPath("/unknown-page")).toBe(false);
  });
});
