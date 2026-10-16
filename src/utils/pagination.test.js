import {describe, expect, it} from "vitest";
import {
  calculateDynamicPageSize,
  getPaginationItems,
  PAGE_SIZE_OPTIONS,
} from "./pagination.js";

describe("pagination utils", () => {
  it("provides standard page size options", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 15, 25, 50, 100]);
  });

  describe("calculateDynamicPageSize", () => {
    it("returns minRows when container height is invalid or small", () => {
      expect(calculateDynamicPageSize(0, 36, 44, 5)).toBe(5);
      expect(calculateDynamicPageSize(-10, 36, 44, 5)).toBe(5);
      expect(calculateDynamicPageSize(30, 36, 44, 5)).toBe(5);
    });

    it("calculates correct row count fitting into available height", () => {
      // 500px container, 36px header, 6px offset -> 458px available / 44px row = 10.4 -> 10 rows
      expect(calculateDynamicPageSize(500, 36, 44, 4)).toBe(10);

      // Larger screen: 800px container, 36px header, 6px offset -> 758px available / 44px row = 17 rows
      expect(calculateDynamicPageSize(800, 36, 44, 4)).toBe(17);

      // Payments table: 600px container, 35px header, 36px row -> 559px / 36px = 15 rows
      expect(calculateDynamicPageSize(600, 35, 36, 5)).toBe(15);
    });

    it("never returns less than minRows", () => {
      expect(calculateDynamicPageSize(100, 36, 44, 6)).toBe(6);
    });
  });

  describe("getPaginationItems", () => {
    it("returns [1] when totalPages is 1 or less", () => {
      expect(getPaginationItems(1, 1)).toEqual([1]);
      expect(getPaginationItems(1, 0)).toEqual([1]);
    });

    it("returns simple array when totalPages <= 7", () => {
      expect(getPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
      expect(getPaginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("shows start pages and ellipsis when near beginning (page <= 4)", () => {
      const items = getPaginationItems(2, 30);
      expect(items).toEqual([
        1,
        2,
        3,
        4,
        5,
        6,
        {type: "ellipsis", targetPage: 7, key: "ellipsis-next"},
        30,
      ]);
    });

    it("shows middle window and both ellipses when in the middle", () => {
      const items = getPaginationItems(10, 30);
      expect(items).toEqual([
        1,
        {type: "ellipsis", targetPage: 5, key: "ellipsis-prev"},
        8,
        9,
        10,
        11,
        12,
        13,
        {type: "ellipsis", targetPage: 15, key: "ellipsis-next"},
        30,
      ]);
    });

    it("shows end pages and left ellipsis when near end", () => {
      const items = getPaginationItems(29, 30);
      expect(items).toEqual([
        1,
        {type: "ellipsis", targetPage: 24, key: "ellipsis-prev"},
        25,
        26,
        27,
        28,
        29,
        30,
      ]);
    });
  });
});
