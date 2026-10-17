import { normalizeCategory, CANONICAL_CATEGORIES } from "./serviceCategories.js";
import {
  getTranslatedCategory,
  getTranslatedService,
  UI_LABELS,
  STUDIO_DEFAULT_CONTACTS,
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
  studioAddress: "", // If empty, falls back to confirmed studio address
  studioPhone: "",
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
 * Resolves clean sorted variants for a service while preserving exact paired prices
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
 * Checks for unusual pricing where longer duration is cheaper than shorter
 */
export function checkUnusualPricing(variants) {
  if (!variants || variants.length < 2) return null;
  for (let i = 0; i < variants.length - 1; i++) {
    const current = variants[i];
    const next = variants[i + 1];
    if (next.duration > current.duration && next.price < current.price) {
      return {
        shorter: current,
        longer: next,
      };
    }
  }
  return null;
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

  return variants
    .map((v) => `${v.duration} ${labels.minUnit} — ${v.price} ${labels.currency}`)
    .join("  ·  ");
}

/**
 * Capacity limits in units of height per format
 */
const FORMAT_PAGE_CAPACITY = {
  a4: 640,
  stories: 480,
  post: 420,
};

/**
 * Calculates item weight for deterministic pagination
 */
function getItemWeight(service, showDescriptions) {
  const variantCount = service.variants?.length || 1;
  // Single variant service takes less vertical room than a 4-variant grid
  let weight = variantCount > 1 ? 52 : 36;
  if (showDescriptions && service.description) {
    weight += 20;
  }
  return weight;
}

/**
 * Splits categorized services into balanced, un-severed editorial pages
 */
export function paginateCategories(categories, format = "a4", showDescriptions = false, labels = UI_LABELS.pl) {
  const maxCapacity = FORMAT_PAGE_CAPACITY[format] || FORMAT_PAGE_CAPACITY.a4;
  const headerWeight = 110;
  const footerWeight = 45;
  const catHeaderWeight = 40;

  const pages = [];
  let currentPage = {
    pageIndex: 1,
    categories: [],
    currentWeight: headerWeight + footerWeight,
  };

  for (const cat of categories) {
    if (!cat.services || cat.services.length === 0) continue;

    let currentCatSegment = {
      id: cat.id,
      rawName: cat.rawName,
      localizedName: cat.localizedName,
      isContinuation: false,
      services: [],
    };

    let catHeaderAdded = false;

    for (let i = 0; i < cat.services.length; i++) {
      const svc = cat.services[i];
      const svcWeight = getItemWeight(svc, showDescriptions);
      const neededWeight = svcWeight + (!catHeaderAdded ? catHeaderWeight : 0);

      const hasContentOnCurrentPage =
        currentPage.categories.length > 0 || currentCatSegment.services.length > 0;

      // If item doesn't fit on current page and page already has items, break to next page
      if (currentPage.currentWeight + neededWeight > maxCapacity && hasContentOnCurrentPage) {
        // Finalize current cat segment if it has items
        if (currentCatSegment.services.length > 0) {
          currentPage.categories.push(currentCatSegment);
        }

        pages.push(currentPage);

        // Start new page
        currentPage = {
          pageIndex: pages.length + 1,
          categories: [],
          currentWeight: 75 + footerWeight, // Sub-header on subsequent pages
        };

        // Next page starts continuation of this category
        currentCatSegment = {
          id: cat.id,
          rawName: cat.rawName,
          localizedName: `${cat.localizedName} ${labels.continued || "(cd.)"}`,
          isContinuation: true,
          services: [],
        };
        catHeaderAdded = false;
      }

      if (!catHeaderAdded) {
        currentPage.currentWeight += catHeaderWeight;
        catHeaderAdded = true;
      }

      currentCatSegment.services.push(svc);
      currentPage.currentWeight += svcWeight;
    }

    if (currentCatSegment.services.length > 0) {
      currentPage.categories.push(currentCatSegment);
    }
  }

  if (currentPage.categories.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  // Assign totalPages to every page
  const totalPages = pages.length;
  return pages.map((page, idx) => ({
    ...page,
    pageIndex: idx + 1,
    totalPages,
    isFirstPage: idx === 0,
    isLastPage: idx === totalPages - 1,
  }));
}

/**
 * Transforms and prepares raw CRM services into grouped price list structure with pagination
 */
export function preparePriceListData(services = [], settings = DEFAULT_PRICE_LIST_SETTINGS, appSettings = null) {
  const {
    language = "pl",
    includeHidden = false,
    excludedCategoryIds = [],
    excludedServiceIds = [],
    priceMode = "full",
    format = "a4",
    showDescriptions = false,
    studioAddress = "",
    studioPhone = "",
  } = settings;

  const baseLabels = UI_LABELS[language] || UI_LABELS.pl;

  // Resolve authentic studio contacts:
  // Priority: 1. Manual override in settings -> 2. appSettings.studioAddress -> 3. Confirmed studio address
  const resolvedAddress =
    studioAddress?.trim() ||
    appSettings?.studioAddress?.trim() ||
    STUDIO_DEFAULT_CONTACTS.address;

  const resolvedPhone =
    studioPhone?.trim() ||
    appSettings?.ownerNotifyPhone?.trim() ||
    STUDIO_DEFAULT_CONTACTS.phone;

  const labels = {
    ...baseLabels,
    address: resolvedAddress,
    phone: resolvedPhone,
  };

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
  const unusualPricingServices = [];

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
    const unusualPricing = checkUnusualPricing(variants);

    if (unusualPricing) {
      unusualPricingServices.push({
        id: svc.id,
        name: svc.name,
        details: unusualPricing,
      });
    }

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

  // 5. Compute paginated pages
  const pages = paginateCategories(categories, format, showDescriptions, labels);

  return {
    categories,
    pages,
    totalServices: totalServicesCount,
    totalCategories: categories.length,
    totalPages: pages.length,
    labels,
    unusualPricingServices,
  };
}
