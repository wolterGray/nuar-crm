import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  preparePriceListData,
  getServiceVariants,
  getServiceMinPrice,
  formatVariantsSummary,
  loadPriceListSettings,
  savePriceListSettings,
  DEFAULT_PRICE_LIST_SETTINGS,
} from "./priceListGenerator.js";
import { getTranslatedCategory, getTranslatedService } from "./priceListTranslations.js";

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
    status: "Скрыта",
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
];

describe("priceListGenerator", () => {
  let memoryStore = {};

  beforeEach(() => {
    memoryStore = {};
    globalThis.window = {
      localStorage: {
        getItem: vi.fn((key) => memoryStore[key] ?? null),
        setItem: vi.fn((key, value) => {
          memoryStore[key] = String(value);
        }),
        removeItem: vi.fn((key) => {
          delete memoryStore[key];
        }),
        clear: vi.fn(() => {
          memoryStore = {};
        }),
      },
    };
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  describe("getServiceVariants & getServiceMinPrice", () => {
    it("extracts and sorts variants by duration ascending", () => {
      const service = {
        variants: [
          { duration: 90, price: 360 },
          { duration: 60, price: 255 },
        ],
      };
      const variants = getServiceVariants(service);
      expect(variants).toEqual([
        { duration: 60, price: 255 },
        { duration: 90, price: 360 },
      ]);
      expect(getServiceMinPrice(service, variants)).toBe(255);
    });

    it("falls back to durationMin and price if no variants array", () => {
      const service = { durationMin: 75, price: 310 };
      const variants = getServiceVariants(service);
      expect(variants).toEqual([{ duration: 75, price: 310 }]);
      expect(getServiceMinPrice(service, variants)).toBe(310);
    });
  });

  describe("formatVariantsSummary", () => {
    const variants = [
      { duration: 60, price: 255 },
      { duration: 90, price: 360 },
    ];

    it("formats full variants list", () => {
      const formatted = formatVariantsSummary(variants, "full", "pl");
      expect(formatted).toBe("60 min — 255 zł  ·  90 min — 360 zł");
    });

    it("formats compact mode with 'od'", () => {
      const formatted = formatVariantsSummary(variants, "compact", "pl");
      expect(formatted).toBe("od 255 zł");
    });

    it("formats compact mode in Russian with 'от'", () => {
      const formatted = formatVariantsSummary(variants, "compact", "ru");
      expect(formatted).toBe("от 255 zł");
    });
  });

  describe("preparePriceListData", () => {
    it("groups services by category and filters out archive", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        includeHidden: false,
      });

      expect(result.totalServices).toBe(2); // ID 1 (active) and ID 3 (active), skips 2 (hidden) and 4 (archive)
      expect(result.categories.length).toBe(2); // Masaże and Rytuały i Kompleksy

      const massageCat = result.categories.find((c) => c.rawName === "Массажи");
      expect(massageCat).toBeDefined();
      expect(massageCat.localizedName).toBe("Masaże");
      expect(massageCat.services[0].id).toBe(1);
    });

    it("includes hidden services when includeHidden is true", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        includeHidden: true,
      });

      expect(result.totalServices).toBe(3); // ID 1, 2, and 3
    });

    it("excludes categories in excludedCategoryIds", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        excludedCategoryIds: ["Комплексы"],
      });

      expect(result.categories.some((c) => c.rawName === "Комплексы")).toBe(false);
      expect(result.totalServices).toBe(1); // Only ID 1
    });

    it("excludes services in excludedServiceIds", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        excludedServiceIds: ["1"],
      });

      const massageCat = result.categories.find((c) => c.rawName === "Массажи");
      expect(massageCat).toBeUndefined(); // ID 1 was only service in that category
      expect(result.totalServices).toBe(1); // Only ID 3
    });

    it("translates to Russian when language is 'ru'", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        language: "ru",
      });

      const massageCat = result.categories.find((c) => c.rawName === "Массажи");
      expect(massageCat.localizedName).toBe("Массажи");
      expect(result.labels.docTitle).toBe("ПРАЙС-ЛИСТ");
      expect(result.labels.fromPrice).toBe("от");
    });
  });

  describe("localStorage settings management", () => {
    it("loads default settings if nothing in localStorage", () => {
      const settings = loadPriceListSettings();
      expect(settings.theme).toBe("dark");
      expect(settings.format).toBe("a4");
      expect(settings.language).toBe("pl");
    });

    it("saves and reloads settings from localStorage", () => {
      const custom = {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        theme: "light",
        format: "stories",
        language: "en",
        excludedServiceIds: ["1", "2"],
      };

      savePriceListSettings(custom);
      const loaded = loadPriceListSettings();
      expect(loaded.theme).toBe("light");
      expect(loaded.format).toBe("stories");
      expect(loaded.language).toBe("en");
      expect(loaded.excludedServiceIds).toEqual(["1", "2"]);
    });
  });

  describe("translations dictionary", () => {
    it("translates canonical categories across languages", () => {
      expect(getTranslatedCategory("Массажи", "pl")).toBe("Masaże");
      expect(getTranslatedCategory("Массажи", "en")).toBe("Massages");
      expect(getTranslatedCategory("Массажи", "ua")).toBe("Масажі");
      expect(getTranslatedCategory("Комплексы", "pl")).toBe("Rytuały i Kompleksy");
    });

    it("translates service names by keyword matching", () => {
      const svc = { name: "Masaż klasyczny" };
      expect(getTranslatedService(svc, "pl").name).toBe("Masaż klasyczny");
      expect(getTranslatedService(svc, "ru").name).toBe("Классический массаж");
      expect(getTranslatedService(svc, "en").name).toBe("Classic Massage");
      expect(getTranslatedService(svc, "ua").name).toBe("Класичний масаж");
    });
  });
});
