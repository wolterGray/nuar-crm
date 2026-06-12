import {describe, expect, it} from "vitest";
import {
  getSupplyStockStatus,
  getSupplyStockStatusLabel,
  isSupplyLowStock,
} from "./supplyStock.js";

describe("supplyStock", () => {
  it("detects low stock when at or below minimum", () => {
    expect(isSupplyLowStock({stock: 2, minStock: 3})).toBe(true);
    expect(isSupplyLowStock({stock: 3, minStock: 3})).toBe(true);
    expect(isSupplyLowStock({stock: 4, minStock: 3})).toBe(false);
  });

  it("returns out status for zero stock", () => {
    expect(getSupplyStockStatus({stock: 0, minStock: 2})).toBe("out");
    expect(getSupplyStockStatusLabel("out")).toBe("Закончился");
  });

  it("returns low status above zero but below minimum", () => {
    expect(getSupplyStockStatus({stock: 1, minStock: 3})).toBe("low");
    expect(getSupplyStockStatusLabel("low")).toBe("Заканчивается");
  });
});
