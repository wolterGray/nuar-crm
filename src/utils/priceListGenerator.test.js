import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  preparePriceListData,
  getServiceVariants,
  getServiceMinPrice,
  formatVariantsSummary,
  checkUnusualPricing,
  paginateCategories,
  loadPriceListSettings,
  savePriceListSettings,
  DEFAULT_PRICE_LIST_SETTINGS,
  resolveDocumentStyle,
  getHexLuminance,
  DESIGN_TEMPLATES,
  loadUserPresets,
  saveUserPresets,
  createPresetFromSettings,
  applyPresetToSettings,
} from "./priceListGenerator.js";
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

  describe("checkUnusualPricing", () => {
    it("detects when a longer duration is cheaper than shorter", () => {
      const variants = [
        { duration: 60, price: 255 },
        { duration: 90, price: 200 }, // Cheaper for longer!
      ];
      const result = checkUnusualPricing(variants);
      expect(result).not.toBeNull();
      expect(result.shorter.duration).toBe(60);
      expect(result.longer.duration).toBe(90);
    });

    it("returns null for normal ascending pricing", () => {
      const variants = [
        { duration: 60, price: 255 },
        { duration: 90, price: 360 },
      ];
      expect(checkUnusualPricing(variants)).toBeNull();
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
    it("groups services by category, excludes archive, and calculates pages", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        includeHidden: false,
      });

      expect(result.totalServices).toBe(3); // ID 1, 3, 5 (skips 2 hidden and 4 archive)
      expect(result.categories.length).toBe(2); // Masaże and Rytuały i kompleksy
      expect(result.pages.length).toBeGreaterThanOrEqual(1);

      const massageCat = result.categories.find((c) => c.rawName === "Массажи");
      expect(massageCat).toBeDefined();
      expect(massageCat.localizedName).toBe("Masaże");
      expect(massageCat.services.length).toBe(2);
    });

    it("resolves confirmed studio address", () => {
      const result = preparePriceListData(mockServices, DEFAULT_PRICE_LIST_SETTINGS);
      expect(result.labels.address).toBe(STUDIO_DEFAULT_CONTACTS.address);
      expect(result.labels.address).toContain("Świętojerska");
    });

    it("respects custom address override from appSettings or user settings", () => {
      const withAppSettings = preparePriceListData(mockServices, DEFAULT_PRICE_LIST_SETTINGS, {
        studioAddress: "ul. Złota 44, Warszawa",
      });
      expect(withAppSettings.labels.address).toBe("ul. Złota 44, Warszawa");

      const withManualOverride = preparePriceListData(
        mockServices,
        {
          ...DEFAULT_PRICE_LIST_SETTINGS,
          studioAddress: "ul. Marszałkowska 1, Warszawa",
        },
        { studioAddress: "ul. Złota 44, Warszawa" }
      );
      expect(withManualOverride.labels.address).toBe("ul. Marszałkowska 1, Warszawa");
    });

    it("includes hidden services when includeHidden is true", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        includeHidden: true,
      });

      expect(result.totalServices).toBe(4); // ID 1, 2, 3, 5
    });

    it("excludes categories in excludedCategoryIds", () => {
      const result = preparePriceListData(mockServices, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        excludedCategoryIds: ["Комплексы"],
      });

      expect(result.categories.some((c) => c.rawName === "Комплексы")).toBe(false);
      expect(result.totalServices).toBe(2); // ID 1, 5
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

  describe("paginateCategories & intelligent layout", () => {
    it("fits 15 single-variant services comfortably on a single A4 sheet without artificial breaks", () => {
      const normalServices = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        displayName: `Masaż ${i + 1}`,
        variants: [{ duration: 60, price: 250 }],
      }));

      const categories = [
        {
          id: "Masaże",
          rawName: "Массажи",
          localizedName: "Masaże",
          services: normalServices,
        },
      ];

      const pages = paginateCategories(categories, "a4", false);
      expect(pages.length).toBe(1);
      expect(pages[0].pageIndex).toBe(1);
      expect(pages[0].totalPages).toBe(1);
    });

    it("fits 15 multi-variant services across 5 categories onto a single A4 page", () => {
      // 5 categories with 3 services each, all having multiple variants
      const categoriesList = ["Массажи", "Лицо", "Тело", "Комплексы", "Абонементы"];
      const services = [];
      let idCounter = 1;

      categoriesList.forEach((catName) => {
        for (let i = 1; i <= 3; i++) {
          services.push({
            id: idCounter++,
            name: `${catName} Услуга ${i}`,
            category: catName,
            status: "Активна",
            variants: [
              { duration: 60, price: 250 },
              { duration: 90, price: 350 },
            ],
          });
        }
      });

      expect(services.length).toBe(15);

      const result = preparePriceListData(services, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        format: "a4",
        pageLayoutMode: "auto",
      });

      expect(result.totalServices).toBe(15);
      expect(result.categories.length).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(result.pages.length).toBe(1);
    });

    it("fits 20 services onto 1 page in compact density", () => {
      const categoriesList = ["Массажи", "Лицо", "Тело", "Комплексы", "Абонементы"];
      const services = [];
      let idCounter = 1;

      categoriesList.forEach((catName) => {
        for (let i = 1; i <= 4; i++) {
          services.push({
            id: idCounter++,
            name: `${catName} Услуга ${i}`,
            category: catName,
            status: "Активна",
            variants: [
              { duration: 60, price: 250 },
              { duration: 90, price: 350 },
            ],
          });
        }
      });

      expect(services.length).toBe(20);

      const result = preparePriceListData(services, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        format: "a4",
        density: "compact",
        pageLayoutMode: "compact",
      });

      expect(result.totalServices).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("splits 30 services into exactly 2 balanced pages (not 3 pages with an awkward trailing page)", () => {
      const categoriesList = ["Массажи", "Лицо", "Тело", "Комплексы", "Абонементы"];
      const services = [];
      let idCounter = 1;

      categoriesList.forEach((catName) => {
        for (let i = 1; i <= 6; i++) {
          services.push({
            id: idCounter++,
            name: `${catName} Услуга ${i}`,
            category: catName,
            status: "Активна",
            variants: [
              { duration: 60, price: 250 },
              { duration: 90, price: 350 },
            ],
          });
        }
      });

      expect(services.length).toBe(30);

      const result = preparePriceListData(services, {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        format: "a4",
        pageLayoutMode: "auto",
      });

      expect(result.totalServices).toBe(30);
      expect(result.totalPages).toBe(2);
      expect(result.pages.length).toBe(2);
      expect(result.pages[0].pageIndex).toBe(1);
      expect(result.pages[1].pageIndex).toBe(2);
    });

    it("splits larger catalogues (30 services) gracefully across multiple balanced pages", () => {
      const manyServices = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        displayName: `Masaż ${i + 1}`,
        variants: [
          { duration: 60, price: 250 },
          { duration: 90, price: 350 },
        ],
      }));

      const categories = [
        {
          id: "Masaże",
          rawName: "Массажи",
          localizedName: "Masaże",
          services: manyServices,
        },
      ];

      const pages = paginateCategories(categories, "a4", false);
      expect(pages.length).toBeGreaterThan(1);
      expect(pages[0].pageIndex).toBe(1);
      expect(pages[0].totalPages).toBe(pages.length);
      expect(pages[1].categories[0].localizedName).toContain("(cd.)");
    });
  });

  describe("resolveDocumentStyle and getHexLuminance", () => {
    it("computes luminance correctly for black and white", () => {
      expect(getHexLuminance("#000000")).toBe(0);
      expect(getHexLuminance("#ffffff")).toBeCloseTo(1, 1);
    });

    it("resolves dark preset to light text", () => {
      const style = resolveDocumentStyle({ bgPreset: "nuar-dark" });
      expect(style.effectiveTextMode).toBe("light");
      expect(style.bgColor).toBe("#0d0d0f");
      expect(style.text).toBe("#ffffff");
    });

    it("resolves cream preset to dark text", () => {
      const style = resolveDocumentStyle({ bgPreset: "cream" });
      expect(style.effectiveTextMode).toBe("dark");
      expect(style.bgColor).toBe("#f7f5f0");
      expect(style.text).toBe("#111113");
    });

    it("resolves custom light hex to dark text automatically", () => {
      const style = resolveDocumentStyle({
        bgPreset: "custom",
        customBgColor: "#f0f4f8",
        textColorMode: "auto",
      });
      expect(style.effectiveTextMode).toBe("dark");
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

  describe("DESIGN_TEMPLATES & User Presets", () => {
    it("defines the 3 core templates: minimal, editorial, and luxury", () => {
      expect(DESIGN_TEMPLATES.minimal).toBeDefined();
      expect(DESIGN_TEMPLATES.minimal.name).toBe("NUAR Minimal");
      expect(DESIGN_TEMPLATES.minimal.defaultTypography).toBe("modern");

      expect(DESIGN_TEMPLATES.editorial).toBeDefined();
      expect(DESIGN_TEMPLATES.editorial.name).toBe("NUAR Editorial");
      expect(DESIGN_TEMPLATES.editorial.defaultTypography).toBe("editorial");

      expect(DESIGN_TEMPLATES.luxury).toBeDefined();
      expect(DESIGN_TEMPLATES.luxury.name).toBe("NUAR Luxury");
      expect(DESIGN_TEMPLATES.luxury.defaultTypography).toBe("luxury");
    });

    it("creates styling preset without storing live prices or service lists", () => {
      const fullSettings = {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        designTemplate: "luxury",
        bgPreset: "warm-graphite",
        typographyFontSize: "lg",
        // CRM data items that must NEVER be saved in preset
        excludedServiceIds: ["1", "2"],
        excludedCategoryIds: ["Архив"],
      };

      const preset = createPresetFromSettings("My Instagram Luxury", fullSettings);
      expect(preset.name).toBe("My Instagram Luxury");
      expect(preset.id).toBeDefined();
      expect(preset.settings.designTemplate).toBe("luxury");
      expect(preset.settings.bgPreset).toBe("warm-graphite");
      expect(preset.settings.typographyFontSize).toBe("lg");

      // Verify CRM data keys were excluded
      expect(preset.settings.excludedServiceIds).toBeUndefined();
      expect(preset.settings.excludedCategoryIds).toBeUndefined();
    });

    it("applies a preset to settings while leaving CRM live service data intact", () => {
      const currentSettings = {
        ...DEFAULT_PRICE_LIST_SETTINGS,
        designTemplate: "minimal",
        bgPreset: "white",
        excludedServiceIds: ["10", "20"],
      };

      const preset = {
        id: "preset_123",
        name: "Dark Luxury",
        settings: {
          designTemplate: "luxury",
          bgPreset: "nuar-dark",
          typographyFamily: "luxury",
        },
      };

      const merged = applyPresetToSettings(preset, currentSettings);
      expect(merged.designTemplate).toBe("luxury");
      expect(merged.bgPreset).toBe("nuar-dark");
      expect(merged.typographyFamily).toBe("luxury");
      // Preserves current excluded services
      expect(merged.excludedServiceIds).toEqual(["10", "20"]);
    });

    it("saves and loads user presets to/from localStorage", () => {
      const presets = [
        {
          id: "p1",
          name: "NUAR Print",
          settings: { designTemplate: "editorial", format: "a4" },
        },
      ];

      saveUserPresets(presets);
      const loaded = loadUserPresets();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe("NUAR Print");
      expect(loaded[0].settings.designTemplate).toBe("editorial");
    });
  });
});
