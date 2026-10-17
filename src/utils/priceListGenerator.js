import { normalizeCategory, CANONICAL_CATEGORIES } from "./serviceCategories.js";
import {
  getTranslatedCategory,
  getTranslatedService,
  UI_LABELS,
  STUDIO_DEFAULT_CONTACTS,
} from "./priceListTranslations.js";

export const STORAGE_KEY_PRICE_LIST = "nuar_price_list_settings_v1";

export const BACKGROUND_PRESETS = {
  "nuar-dark": {
    id: "nuar-dark",
    label: "Nuar Dark",
    bg: "#0d0d0f",
    textMode: "light",
  },
  "warm-graphite": {
    id: "warm-graphite",
    label: "Warm Graphite",
    bg: "#18171a",
    textMode: "light",
  },
  "cream": {
    id: "cream",
    label: "Cream",
    bg: "#f7f5f0",
    textMode: "dark",
  },
  "white": {
    id: "white",
    label: "White",
    bg: "#ffffff",
    textMode: "dark",
  },
};

export const DEFAULT_PRICE_LIST_SETTINGS = {
  theme: "dark", // "dark" | "light" (legacy compatibility)
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

  // Typography
  typographyFamily: "editorial", // "modern" | "classic" | "editorial"
  typographyFontSize: "md", // "sm" | "md" | "lg"
  typographyHeadingSize: "md", // "sm" | "md" | "lg"
  density: "normal", // "compact" | "normal" | "spacious"

  // Page layout mode
  pageLayoutMode: "auto", // "auto" | "compact" | "spacious"

  // Background
  bgPreset: "nuar-dark", // "nuar-dark" | "warm-graphite" | "cream" | "white" | "custom"
  customBgColor: "#0d0d0f",
  bgImage: null, // data URL string
  bgImageOpacity: 40, // 0..90
  bgImageSize: "cover", // "cover" | "contain" | "repeat"
  bgImagePosition: "center", // "center" | "top" | "bottom"
  textColorMode: "auto", // "auto" | "light" | "dark"

  // Logo
  showLogo: true,
  logoType: "default", // "default" | "custom" | "text"
  customLogoUrl: null, // data URL string
  logoSize: "md", // "sm" | "md" | "lg"
  logoAlign: "center", // "left" | "center" | "right"
};

/**
 * Calculates relative luminance of a HEX color
 */
export function getHexLuminance(hex) {
  if (!hex || typeof hex !== "string") return 0;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 3 && clean.length !== 6) return 0;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return 0;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Resolves full cohesive styling parameters for preview and export
 */
export function resolveDocumentStyle(settings = {}) {
  const {
    bgPreset = "nuar-dark",
    customBgColor = "#0d0d0f",
    textColorMode = "auto",
    theme = "dark",
  } = settings;

  let base = BACKGROUND_PRESETS[bgPreset];
  let bgColor = base ? base.bg : customBgColor;

  if (bgPreset === "custom") {
    bgColor = customBgColor || "#0d0d0f";
  } else if (!base) {
    bgColor = theme === "light" ? "#ffffff" : "#0d0d0f";
  }

  // Determine text lightness
  let effectiveTextMode = textColorMode;
  if (textColorMode === "auto") {
    const lum = getHexLuminance(bgColor);
    effectiveTextMode = lum > 0.45 ? "dark" : "light";
  }

  const isLightText = effectiveTextMode === "light";

  return {
    bgColor,
    effectiveTextMode,
    isLightText,
    text: isLightText ? "#ffffff" : "#111113",
    muted: isLightText ? "#9e9ea6" : "#64646c",
    faint: isLightText ? "#6e6e76" : "#8a8a92",
    border: isLightText
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.08)",
    dots: isLightText
      ? "rgba(255, 255, 255, 0.16)"
      : "rgba(0, 0, 0, 0.18)",
    accent: isLightText ? "#e11d2e" : "#c91827",
    chipBg: isLightText
      ? "rgba(255, 255, 255, 0.04)"
      : "rgba(0, 0, 0, 0.03)",
  };
}

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
      excludedCategoryIds: Array.isArray(parsed.excludedCategoryIds)
        ? parsed.excludedCategoryIds
        : [],
      excludedServiceIds: Array.isArray(parsed.excludedServiceIds)
        ? parsed.excludedServiceIds
        : [],
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
 * Realistic capacity limits in units of height per format and layout mode
 */
export const FORMAT_PAGE_CAPACITY = {
  a4: {
    compact: 960,
    auto: 930,
    spacious: 820,
  },
  stories: {
    compact: 840,
    auto: 760,
    spacious: 660,
  },
  post: {
    compact: 640,
    auto: 560,
    spacious: 480,
  },
};

/**
 * Calculates item weight for deterministic pagination
 */
function getItemWeight(service, showDescriptions, density = "normal") {
  const variantCount = service.variants?.length || 1;
  const isMulti = variantCount > 1;

  let weight;
  if (density === "compact") {
    weight = isMulti ? 34 : 22;
  } else if (density === "spacious") {
    weight = isMulti ? 52 : 34;
  } else {
    // normal
    weight = isMulti ? 40 : 26;
  }

  if (showDescriptions && service.description) {
    weight += density === "compact" ? 12 : density === "spacious" ? 20 : 16;
  }
  return weight;
}

/**
 * Splits categorized services into balanced, un-severed editorial pages
 */
export function paginateCategories(
  categories,
  format = "a4",
  showDescriptions = false,
  labels = UI_LABELS.pl,
  layoutOptions = {}
) {
  const density = layoutOptions.density || "normal";
  const pageLayoutMode = layoutOptions.pageLayoutMode || "auto";

  const formatCaps = FORMAT_PAGE_CAPACITY[format] || FORMAT_PAGE_CAPACITY.a4;
  const maxCapacity =
    typeof formatCaps === "number"
      ? formatCaps
      : formatCaps[pageLayoutMode] || formatCaps.auto;

  const headerWeight = density === "compact" ? 65 : density === "spacious" ? 95 : 75;
  const subHeaderWeight = density === "compact" ? 28 : density === "spacious" ? 44 : 34;
  const footerWeight = density === "compact" ? 26 : density === "spacious" ? 38 : 30;
  const catHeaderWeight = density === "compact" ? 20 : density === "spacious" ? 32 : 24;

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
      const svcWeight = getItemWeight(svc, showDescriptions, density);
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
          currentWeight: subHeaderWeight + footerWeight, // Sub-header on subsequent pages
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

  // 5. Intelligent Multi-Pass Pagination
  const requestedDensity = settings.density || "normal";
  const pageLayoutMode = settings.pageLayoutMode || "auto";

  let effectiveDensity = requestedDensity;
  let pages = paginateCategories(
    categories,
    format,
    showDescriptions,
    labels,
    {
      density: requestedDensity,
      pageLayoutMode,
    }
  );

  // If in "auto" mode (or normal density), check if slight compaction eliminates awkward page breaks:
  // 1) If 2 pages but can comfortably fit on 1 page with compact spacing
  // 2) If 3 pages but can comfortably fit on 2 balanced pages with compact spacing
  if (pageLayoutMode === "auto" && requestedDensity === "normal" && pages.length > 1) {
    const compactPages = paginateCategories(
      categories,
      format,
      showDescriptions,
      labels,
      {
        density: "compact",
        pageLayoutMode: "auto",
      }
    );

    // If compact pass fits everything on 1 page, or reduces 3 pages to 2 pages
    if (
      (pages.length === 2 && compactPages.length === 1) ||
      (pages.length === 3 && compactPages.length === 2)
    ) {
      pages = compactPages;
      effectiveDensity = "compact";
    }
  }

  const style = resolveDocumentStyle(settings);

  return {
    categories,
    pages,
    totalServices: totalServicesCount,
    totalCategories: categories.length,
    totalPages: pages.length,
    effectiveDensity,
    labels,
    style,
    unusualPricingServices,
  };
}
