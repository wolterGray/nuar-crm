import { normalizeCategory, CANONICAL_CATEGORIES } from "./serviceCategories.js";
import {
  getTranslatedCategory,
  getTranslatedService,
  UI_LABELS,
} from "./priceListTranslations.js";

export const STORAGE_KEY_PRICE_LIST = "nuar_price_list_settings_v1";

export const DEFAULT_PRICE_LIST_SETTINGS = {
  theme: "dark", // "dark" | "light"
  format: "a4", // "a4" | "stories" | "post"
  priceMode: "full", // "full" | "compact"
  language: "pl", // "pl" | "ru" | "en" | "ua"
  includeHidden: false,
  showDescriptions: false,
  showContacts: true,
  excludedCategoryIds: [],
  excludedServiceIds: [],
};

/**
 * Loads price list settings safely from localStorage
 */
export function loadPriceListSettings() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_PRICE_LIST_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PRICE_LIST);
    if (!raw) return { ...DEFAULT_PRICE_LIST_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PRICE_LIST_SETTINGS,
      ...parsed,
      excludedCategoryIds: Array.isArray(parsed.excludedCategoryIds) ? parsed.excludedCategoryIds : [],
      excludedServiceIds: Array.isArray(parsed.excludedServiceIds) ? parsed.excludedServiceIds : [],
    };
  } catch (err) {
    console.warn("Failed to load price list settings from localStorage:", err);
    return { ...DEFAULT_PRICE_LIST_SETTINGS };
  }
}

/**
 * Saves price list settings to localStorage
 */
export function savePriceListSettings(settings) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_PRICE_LIST, JSON.stringify(settings));
  } catch (err) {
    console.warn("Failed to save price list settings to localStorage:", err);
  }
}

/**
 * Resolves clean sorted variants for a service
 */
export function getServiceVariants(service) {
  if (Array.isArray(service.variants) && service.variants.length > 0) {
    const cleaned = service.variants
      .map((v) => ({
        duration: Number(v.duration || v.d || 0),
        price: Number(v.price || v.p || 0),
      }))
      .filter((v) => v.duration > 0 && v.price > 0)
      .sort((a, b) => a.duration - b.duration);

    if (cleaned.length > 0) return cleaned;
  }

  // Fallback to top-level durationMin and price
  const duration = Number(service.durationMin || service.duration || 60);
  const price = Number(service.price || 0);
  if (price > 0) {
    return [{ duration, price }];
  }
  return [];
}

/**
 * Computes minPrice for compact mode
 */
export function getServiceMinPrice(service, variants = null) {
  const vars = variants || getServiceVariants(service);
  if (vars.length > 0) {
    return Math.min(...vars.map((v) => v.price));
  }
  return Number(service.price || 0);
}

/**
 * Formats duration and price row for full or compact mode
 */
export function formatVariantsSummary(variants, priceMode, lang = "pl") {
  const labels = UI_LABELS[lang] || UI_LABELS.pl;
  if (!variants || variants.length === 0) return "";

  if (priceMode === "compact") {
    const minP = Math.min(...variants.map((v) => v.price));
    return `${labels.fromPrice} ${minP} ${labels.currency}`;
  }

  // Full mode: "60 min — 255 zł · 90 min — 360 zł"
  return variants
    .map((v) => `${v.duration} ${labels.minUnit} — ${v.price} ${labels.currency}`)
    .join("  ·  ");
}

/**
 * Transforms and prepares raw CRM services into grouped price list structure
 */
export function preparePriceListData(services = [], settings = DEFAULT_PRICE_LIST_SETTINGS) {
  const {
    language = "pl",
    includeHidden = false,
    excludedCategoryIds = [],
    excludedServiceIds = [],
    priceMode = "full",
  } = settings;

  const excludedCatSet = new Set(excludedCategoryIds);
  const excludedSvcSet = new Set(excludedServiceIds.map(String));

  // 1. Filter services: exclude Archive and optionally Hidden
  const eligibleServices = services.filter((svc) => {
    if (!svc) return false;
    const status = svc.status || "Активна";
    if (status === "Архив") return false;
    if (!includeHidden && status === "Скрыта") return false;
    if (excludedSvcSet.has(String(svc.id))) return false;
    return true;
  });

  // 2. Group by normalized category
  const groupsMap = new Map();

  eligibleServices.forEach((svc) => {
    const rawCat = svc.category || "Без категории";
    const normCat = normalizeCategory(rawCat);

    if (excludedCatSet.has(normCat) || excludedCatSet.has(rawCat)) {
      return;
    }

    if (!groupsMap.has(normCat)) {
      groupsMap.set(normCat, []);
    }

    const variants = getServiceVariants(svc);
    const minPrice = getServiceMinPrice(svc, variants);
    const translated = getTranslatedService(svc, language);

    groupsMap.get(normCat).push({
      ...svc,
      id: svc.id,
      name: svc.name,
      displayName: translated.name,
      description: translated.description,
      variants,
      minPrice,
      isCombo: svc.serviceType === "combo",
      formattedPrice: formatVariantsSummary(variants, priceMode, language),
    });
  });

  // 3. Sort categories: canonical order first, then alphabetical
  const sortedCategoryNames = Array.from(groupsMap.keys()).sort((a, b) => {
    const idxA = CANONICAL_CATEGORIES.indexOf(a);
    const idxB = CANONICAL_CATEGORIES.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // 4. Assemble clean categories
  let totalServicesCount = 0;
  const categories = sortedCategoryNames
    .map((catName) => {
      const items = groupsMap.get(catName) || [];
      if (items.length === 0) return null;

      // Sort services inside category by minPrice or name
      items.sort((a, b) => a.minPrice - b.minPrice || a.displayName.localeCompare(b.displayName));

      totalServicesCount += items.length;

      return {
        id: catName,
        rawName: catName,
        localizedName: getTranslatedCategory(catName, language),
        services: items,
      };
    })
    .filter(Boolean);

  return {
    categories,
    totalServices: totalServicesCount,
    totalCategories: categories.length,
    labels: UI_LABELS[language] || UI_LABELS.pl,
  };
}
