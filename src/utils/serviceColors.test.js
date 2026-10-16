import {describe, expect, it} from "vitest";
import {
  categoryColorMap,
  getCategoryColor,
  getServiceColor,
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
});
