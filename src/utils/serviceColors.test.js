import {describe, expect, it} from "vitest";
import {
  categoryColorMap,
  getCategoryColor,
  getServiceBadgeStyle,
  getServiceColor,
  hexToRgba,
  normalizeServiceColors,
} from "./serviceColors.js";

describe("serviceColors", () => {
  it("returns predefined colors for standard categories", () => {
    expect(getCategoryColor("Массаж")).toBe(categoryColorMap["Массаж"]);
    expect(getCategoryColor("Массажи")).toBe(categoryColorMap["Массажи"]);
    expect(getCategoryColor("Комплексы")).toBe(categoryColorMap["Комплексы"]);
    expect(getCategoryColor("Body Wrapping")).toBe(categoryColorMap["Body Wrapping"]);
    expect(getCategoryColor("")).toBe("#71717a");
    expect(getServiceColor({id: 1, name: "Test", color: "#ef4444"})).toBe("#ef4444");
  });

  it("returns deterministic color for arbitrary category", () => {
    const color1 = getCategoryColor("SPA ритуалы");
    const color2 = getCategoryColor("SPA ритуалы");
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("normalizes service colors across an array", () => {
    const rawServices = [
      {id: 1, name: "Massage 1", color: "#ef4444"},
      {id: 2, name: "Massage 2"},
    ];
    const normalized = normalizeServiceColors(rawServices);
    expect(normalized[0].color).toBe("#ef4444");
    expect(normalized[1].color).toBeDefined();
    expect(normalized[1].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("converts hex to rgba string with custom alpha", () => {
    expect(hexToRgba("#5e6ad2", 0.15)).toBe("rgba(94, 106, 210, 0.15)");
    expect(hexToRgba("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(hexToRgba("", 0.2)).toBe("rgba(138, 143, 152, 0.2)");
  });

  it("generates correct badge styles with soft translucent background and colored text", () => {
    const badgeStyle = getServiceBadgeStyle("#5e6ad2");
    expect(badgeStyle.backgroundColor).toBe("rgba(94, 106, 210, 0.14)");
    expect(badgeStyle.borderColor).toBe("rgba(94, 106, 210, 0.28)");
    expect(badgeStyle.color).toBe("#5e6ad2");
  });
});

