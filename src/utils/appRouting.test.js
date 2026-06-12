import {describe, expect, it} from "vitest";
import {
  getPageFromPath,
  getPathFromPage,
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
});
