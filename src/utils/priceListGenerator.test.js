import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  preparePriceListData,
  getServiceVariants,
  getServiceMinPrice,
  formatVariantsSummary,
  checkUnusualPricing,
  paginateCategories,
  normalizePriceListCategory,
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
  // Couple massage as separate entries to test safe consolidation
  {
    id: 6,
    name: "Masaż dla dwojga",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 60, price: 500 },
    ],
  },
  {
    id: 7,
    name: "Masaż dla dwojga",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 90, price: 650 },
    ],
  },
  // Distinct anti-cellulite services to test non-mangling
  {
    id: 8,
    name: "Masaż antycellulitowy",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 60, price: 255 },
      { duration: 90, price: 360 },
    ],
  },
  {
    id: 9,
    name: "Masaż antycellulitowy + drenaż limfatyczny",
    category: "Массажи",
    status: "Активна",
    variants: [
      { duration: 70, price: 210 },
    ],
  },
];

describe("priceListGenerator (Table Architecture)", () => {
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

  describe("normalizePriceListCategory", () => {
    it("maps Polish and Russian variations correctly", () => {
      expect(normalizePriceListCategory("Массажи")).toBe("Masaże");
      expect(normalizePriceListCategory("Массаж")).toBe("Masaże");
      expect(normalizePriceListCategory("Masaże")).toBe("Masaże");
      expect(normalizePriceListCategory("Комплексы")).toBe("Rytuały i kompleksy");
      expect(normalizePriceListCategory("Rytuały i kompleksy")).toBe("Rytuały i kompleksy");
      expect(normalizePriceListCategory("Массажи — Master")).toBe("Masaże — Master");
      expect(normalizePriceListCategory("Массажи — Top-Master")).toBe("Masaże — Top-Master");
      expect(normalizePriceListCategory("Body Wrapping")).toBe("Body Wrapping");
    });
  });

  describe("preparePriceListData", () => {
    it("automatically excludes archive and inactive services", () => {
      const result = preparePriceListData(mockServices);
      // Service 2 ("Неактивна") and 4 ("Архив") are excluded
      expect(result.totalServices).toBe(6);
      expect(result.categories.length).toBe(2); // "Masaże" & "Rytuały i kompleksy"
    });

    it("consolidates duplicate entries for the same service (Masaż dla dwojga) into a single row with duration columns", () => {
      const result = preparePriceListData(mockServices);
      const massageCat = result.categories.find((c) => c.localizedName === "Masaże");
      expect(massageCat).toBeDefined();

      // Find Masaż dla dwojga
      const coupleServices = massageCat.services.filter(
        (s) => s.displayName === "Masaż dla dwojga"
      );
      expect(coupleServices).toHaveLength(1); // Merged into 1 row!
      expect(coupleServices[0].variants).toEqual([
        { duration: 60, price: 500 },
        { duration: 90, price: 650 },
      ]);
    });

    it("does not merge distinct services with distinct titles (Masaż antycellulitowy vs Masaż antycellulitowy + drenaż limfatyczny)", () => {
      const result = preparePriceListData(mockServices);
      const massageCat = result.categories.find((c) => c.localizedName === "Masaże");
      expect(massageCat).toBeDefined();

      const baseAnti = massageCat.services.find(
        (s) => s.displayName === "Masaż antycellulitowy"
      );
      const comboAnti = massageCat.services.find(
        (s) => s.displayName === "Masaż antycellulitowy + drenaż limfatyczny"
      );

      expect(baseAnti).toBeDefined();
      expect(comboAnti).toBeDefined();
      expect(baseAnti.variants).toHaveLength(2);
      expect(comboAnti.variants).toHaveLength(1);
      expect(comboAnti.variants[0].duration).toBe(70);
    });

    it("calculates distinct category duration columns", () => {
      const result = preparePriceListData(mockServices);
      const massageCat = result.categories.find((c) => c.localizedName === "Masaże");
      expect(massageCat).toBeDefined();

      // Durations in Masaże: 60, 70, 75, 90, 120 min
      expect(massageCat.durations).toEqual([60, 70, 75, 90, 120]);

      const ritualCat = result.categories.find((c) => c.localizedName === "Rytuały i kompleksy");
      expect(ritualCat).toBeDefined();
      expect(ritualCat.durations).toEqual([120]);
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
          durations: [60],
          services,
        },
      ];

      const pages = paginateCategories(categories);
      expect(pages.length).toBe(1);
      expect(pages[0].categories[0].services.length).toBe(15);
    });

    it("splits larger catalogues gracefully across multiple balanced pages", () => {
      const services = Array.from({ length: 48 }).map((_, i) => ({
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
          durations: [60, 90, 120],
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
