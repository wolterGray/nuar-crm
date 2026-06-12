import {describe, expect, it, vi} from "vitest";
import {normalizeSupplyOrderUrl, openSupplyOrderUrl} from "./supplyOrder.js";

describe("supplyOrder", () => {
  it("normalizes empty values", () => {
    expect(normalizeSupplyOrderUrl("")).toBe("");
    expect(normalizeSupplyOrderUrl("   ")).toBe("");
  });

  it("adds https protocol when missing", () => {
    expect(normalizeSupplyOrderUrl("shop.example.com/item")).toBe(
      "https://shop.example.com/item",
    );
  });

  it("keeps existing protocol", () => {
    expect(normalizeSupplyOrderUrl("http://shop.example.com")).toBe(
      "http://shop.example.com",
    );
  });

  it("opens normalized url in a new tab", () => {
    const openMock = vi.fn();
    vi.stubGlobal("window", {open: openMock});

    expect(openSupplyOrderUrl("shop.example.com/oil")).toBe(true);
    expect(openMock).toHaveBeenCalledWith(
      "https://shop.example.com/oil",
      "_blank",
      "noopener,noreferrer",
    );

    vi.unstubAllGlobals();
  });

  it("returns false when url is empty", () => {
    const openMock = vi.fn();
    vi.stubGlobal("window", {open: openMock});

    expect(openSupplyOrderUrl("")).toBe(false);
    expect(openMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
