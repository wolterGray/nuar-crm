import {describe, expect, it} from "vitest";
import {
  CANONICAL_CATEGORIES,
  formatServiceCountRu,
  inferMassageSubType,
  normalizeCategory,
} from "./serviceCategories.js";

describe("serviceCategories", () => {
  it("exports canonical categories list", () => {
    expect(CANONICAL_CATEGORIES).toEqual(["Массажи", "Комплексы", "Body Wrapping"]);
  });

  it("normalizes category names to canonical groups", () => {
    expect(normalizeCategory("Массаж")).toBe("Массажи");
    expect(normalizeCategory("Массажи")).toBe("Массажи");
    expect(normalizeCategory("Комплексы")).toBe("Комплексы");
    expect(normalizeCategory("Комплекс")).toBe("Комплексы");
    expect(normalizeCategory("Body Wrapping")).toBe("Body Wrapping");
    expect(normalizeCategory("bodywrapping")).toBe("Body Wrapping");
    expect(normalizeCategory("")).toBe("Без категории");
    expect(normalizeCategory(null)).toBe("Без категории");
    expect(normalizeCategory("SPA")).toBe("SPA");
  });

  it("infers massage sub-types accurately from service names", () => {
    expect(inferMassageSubType({name: "Masaż klasyczny (Master)"})).toBe("Классический");
    expect(inferMassageSubType({name: "Masaż relaksacyjny całego ciała"})).toBe("Расслабляющий");
    expect(inferMassageSubType({name: "Masaż sportowy"})).toBe("Спортивный");
    expect(inferMassageSubType({name: "Masaż limfatyczny"})).toBe("Лимфодренажный");
    expect(inferMassageSubType({name: "Masaż drenaż limfatyczny"})).toBe("Лимфодренажный");
    expect(inferMassageSubType({name: "Masaż antycellulitowy (Top Master)"})).toBe("Антицеллюлитный");
    expect(inferMassageSubType({name: "Masaż autorski"})).toBe("Авторский");
    expect(inferMassageSubType({name: "Masaż dla dwojga"})).toBe("Парный");
    expect(inferMassageSubType({name: "Парный массаж"})).toBe("Парный");
    expect(inferMassageSubType({name: "Masaż twarzy i głowy"})).toBe("Лицо и голова");
    expect(inferMassageSubType({name: "Masaż dla dzieci"})).toBe("Детский");
    expect(inferMassageSubType({name: "Комплекс Nuar"})).toBeNull();
    expect(inferMassageSubType({name: "SPA Комплекс Релакс"})).toBe("Расслабляющий");
  });

  it("prioritizes explicitly defined subType", () => {
    expect(inferMassageSubType({name: "Masaż klasyczny", subType: "Авторский"})).toBe("Авторский");
  });

  it("formats service count in Russian correctly", () => {
    expect(formatServiceCountRu(1)).toBe("услуга");
    expect(formatServiceCountRu(2)).toBe("услуги");
    expect(formatServiceCountRu(4)).toBe("услуги");
    expect(formatServiceCountRu(5)).toBe("услуг");
    expect(formatServiceCountRu(8)).toBe("услуг");
    expect(formatServiceCountRu(12)).toBe("услуг");
    expect(formatServiceCountRu(21)).toBe("услуга");
    expect(formatServiceCountRu(22)).toBe("услуги");
  });
});
