import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  preparePriceListData,
  getServiceVariants,
  getServiceMinPrice,
  formatVariantsSummary,
  checkUnusualPricing,
  paginateCategories,
} from "./priceListGenerator.js";
import { downloadPriceListPdf } from "./priceListExporter.js";
import { STUDIO_DEFAULT_CONTACTS } from "./priceListTranslations.js";

const mockServices = [
  {
    id: 1,
    name: "Masaż klasyczny",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 60, price: 255 },
      { duration: 90, price: 360 },
      { duration: 120, price: 450 },
    ],
  },
  {
    id: 2,
    name: "Masaż relaksacyjny",
    category: "Массажи",
    status: "Неактивна",
    variants: [
      { duration: 60, price: 255 },
      { duration: 90, price: 360 },
    ],
  },
  {
    id: 3,
    name: "Rytuał Nuar",
    category: "Комплексы",
    serviceType: "combo",
    status: "Активна",
    variants: [
      { duration: 120, price: 590 },
    ],
  },
  {
    id: 4,
    name: "Старый массаж",
    category: "Массажи",
    status: "Архив",
    price: 150,
    durationMin: 60,
  },
  {
    id: 5,
    name: "Masaż sportowy",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 60, price: 265 },
      { duration: 75, price: 315 },
      { duration: 90, price: 370 },
      { duration: 120, price: 450 },
    ],
  },
];

describe("priceListGenerator (Simplified Core)", () => {
  describe("getServiceVariants & getServiceMinPrice", () => {
    it("extracts and sorts variants by duration ascending", () => {
      const variants = getServiceVariants({
        variants: [
          { duration: 90, price: 350 },
          { duration: 60, price: 250 },
        ],
      });
      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual({ duration: 60, price: 250 });
      expect(variants[1]).toEqual({ duration: 90, price: 350 });
      expect(getServiceMinPrice({}, variants)).toBe(250);
    });

    it("falls back to durationMin and price if no variants array", () => {
      const variants = getServiceVariants({
        price: 300,
        durationMin: 75,
      });
      expect(variants).toEqual([{ duration: 75, price: 300 }]);
      expect(getServiceMinPrice({ price: 300 }, variants)).toBe(300);
    });
  });

  describe("checkUnusualPricing", () => {
    it("detects when a longer duration is cheaper than shorter", () => {
      const unusual = [
        { duration: 60, price: 300 },
        { duration: 90, price: 250 },
      ];
      const result = checkUnusualPricing(unusual);
      expect(result).not.toBeNull();
      expect(result.shorter.duration).toBe(60);
      expect(result.longer.duration).toBe(90);
    });

    it("returns null for normal ascending pricing", () => {
      const normal = [
        { duration: 60, price: 250 },
        { duration: 90, price: 350 },
      ];
      expect(checkUnusualPricing(normal)).toBeNull();
    });
  });

  describe("formatVariantsSummary", () => {
    it("formats full variants list", () => {
      const variants = [
        { duration: 60, price: 200 },
        { duration: 90, price: 280 },
      ];
      const summary = formatVariantsSummary(variants, "full", "pl");
      expect(summary).toBe("60 min — 200 zł  ·  90 min — 280 zł");
    });
  });

  describe("preparePriceListData", () => {
    it("automatically excludes archive and inactive services", () => {
      const result = preparePriceListData(mockServices);
      // Service 1, 3, 5 are active -> included
      // Service 2 is "Неактивна" -> excluded
      // Service 4 is "Архив" -> excluded
      expect(result.totalServices).toBe(3);
      expect(result.categories.length).toBe(2); // "Массажи" & "Комплексы"

      const catNames = result.categories.map((c) => c.localizedName);
      expect(catNames).toContain("Masaże");
      expect(catNames).toContain("Rytuały i kompleksy");
    });

    it("resolves confirmed studio address", () => {
      const result = preparePriceListData(mockServices);
      expect(result.labels.address).toBe(STUDIO_DEFAULT_CONTACTS.address);
      expect(result.labels.phone).toBe(STUDIO_DEFAULT_CONTACTS.phone);
    });

    it("respects custom address override from appSettings", () => {
      const withAppSettings = preparePriceListData(mockServices, {
        studioAddress: "ul. Marszałkowska 10, Warszawa",
        ownerNotifyPhone: "+48 500 000 000",
      });
      expect(withAppSettings.labels.address).toBe("ul. Marszałkowska 10, Warszawa");
      expect(withAppSettings.labels.phone).toBe("+48 500 000 000");
    });

    it("generates multi-page A4 structure with correct page counts", () => {
      const result = preparePriceListData(mockServices);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.pages[0].isFirstPage).toBe(true);
      expect(result.pages[0].totalPages).toBe(result.totalPages);
    });
  });

  describe("paginateCategories & A4 layout", () => {
    it("fits 15 single-variant services comfortably on a single A4 sheet without artificial breaks", () => {
      const services = Array.from({ length: 15 }).map((_, i) => ({
        id: i + 1,
        name: `Masaż ${i + 1}`,
        displayName: `Masaż ${i + 1}`,
        category: "Masaże",
        variants: [{ duration: 60, price: 200 + i * 10 }],
      }));

      const categories = [
        {
          id: "Masaże",
          rawName: "Masaże",
          localizedName: "Masaże",
          services,
        },
      ];

      const pages = paginateCategories(categories);
      expect(pages.length).toBe(1);
      expect(pages[0].categories[0].services.length).toBe(15);
    });

    it("splits larger catalogues gracefully across multiple balanced pages", () => {
      const services = Array.from({ length: 38 }).map((_, i) => ({
        id: i + 1,
        name: `Usługa ${i + 1}`,
        displayName: `Usługa ${i + 1}`,
        category: "Masaże",
        variants: [
          { duration: 60, price: 200 },
          { duration: 90, price: 280 },
          { duration: 120, price: 360 },
        ],
      }));

      const categories = [
        {
          id: "Masaże",
          rawName: "Masaże",
          localizedName: "Masaże",
          services,
        },
      ];

      const pages = paginateCategories(categories);
      expect(pages.length).toBeGreaterThan(1);
      expect(pages[0].totalPages).toBe(pages.length);
      expect(pages[pages.length - 1].isLastPage).toBe(true);
    });
  });

  describe("downloadPriceListPdf exporter", () => {
    let originalWindow;

    beforeEach(() => {
      originalWindow = globalThis.window;
      globalThis.window = {
        print: vi.fn(),
      };
      globalThis.document = {
        title: "Test",
      };
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it("invokes native browser print for high-quality vector PDF output", () => {
      downloadPriceListPdf();
      expect(globalThis.window.print).toHaveBeenCalledTimes(1);
    });
  });
});
