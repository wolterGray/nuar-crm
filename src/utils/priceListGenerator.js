import { normalizeCategory } from "./serviceCategories.js";
import {
  getTranslatedCategory,
  getTranslatedService,
  UI_LABELS,
  STUDIO_DEFAULT_CONTACTS,
} from "./priceListTranslations.js";

/**
 * Standard Polish canonical category display order for the price list
 */
export const PRICE_LIST_CATEGORY_ORDER = [
  "Masaże",
  "Rytuały i kompleksy",
  "Body Wrapping",
  "Masaże — Master",
  "Masaże — Top-Master",
];

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
 * Computes minPrice for service
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
 * Formats duration and price summary string (for text export/debug)
 */
export function formatVariantsSummary(variants, priceMode = "full", lang = "pl") {
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
 * Normalizes category for price list grouping, mapping Polish and Russian variations
 */
export function normalizePriceListCategory(rawCategory) {
  const s = String(rawCategory ?? "").trim();
  if (!s) return "Pozostałe usługi";
  const lower = s.toLowerCase();

  // Top-Master
  if (lower.includes("top-master") || lower.includes("топ-мастер")) {
    return "Masaże — Top-Master";
  }
  // Master
  if (lower.includes("master") || lower.includes("мастер")) {
    return "Masaże — Master";
  }
  // Body Wrapping
  if (lower.includes("body") || lower.includes("wrapping") || lower.includes("оберт") || lower.includes("обёрт")) {
    return "Body Wrapping";
  }
  // Rituals / Complexes
  if (lower.includes("kompleks") || lower.includes("комплекс") || lower.includes("rytuał") || lower.includes("ритуал")) {
    return "Rytuały i kompleksy";
  }
  // General Massages
  if (lower.includes("masaż") || lower.includes("masaz") || lower.includes("массаж") || lower.includes("массажи")) {
    return "Masaże";
  }

  // Use general category normalizer fallback
  const baseNorm = normalizeCategory(s);
  return getTranslatedCategory(baseNorm, "pl");
}

/**
 * Fixed A4 page height budget in relative units
 */
export const A4_PAGE_CAPACITY = 920;

/**
 * Splits categorized services into balanced A4 pages with table headers
 */
export function paginateCategories(categories, labels = UI_LABELS.pl) {
  const maxCapacity = A4_PAGE_CAPACITY;

  const headerWeight = 72;
  const subHeaderWeight = 34;
  const footerWeight = 30;
  const catHeaderWeight = 26;
  const tableHeaderWeight = 18;
  const rowWeight = 18; // Compact table row

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
      durations: cat.durations,
      isContinuation: false,
      services: [],
    };

    let catHeaderAdded = false;

    for (let i = 0; i < cat.services.length; i++) {
      const svc = cat.services[i];
      const neededWeight = rowWeight + (!catHeaderAdded ? (catHeaderWeight + tableHeaderWeight) : 0);

      const hasContentOnCurrentPage =
        currentPage.categories.length > 0 || currentCatSegment.services.length > 0;

      // If item doesn't fit on current page, advance to next page
      if (currentPage.currentWeight + neededWeight > maxCapacity && hasContentOnCurrentPage) {
        if (currentCatSegment.services.length > 0) {
          currentPage.categories.push(currentCatSegment);
        }

        pages.push(currentPage);

        currentPage = {
          pageIndex: pages.length + 1,
          categories: [],
          currentWeight: subHeaderWeight + footerWeight,
        };

        currentCatSegment = {
          id: cat.id,
          rawName: cat.rawName,
          localizedName: `${cat.localizedName} ${labels.continued || "(cd.)"}`,
          durations: cat.durations,
          isContinuation: true,
          services: [],
        };
        catHeaderAdded = false;
      }

      if (!catHeaderAdded) {
        currentPage.currentWeight += (catHeaderWeight + tableHeaderWeight);
        catHeaderAdded = true;
      }

      currentCatSegment.services.push(svc);
      currentPage.currentWeight += rowWeight;
    }

    if (currentCatSegment.services.length > 0) {
      currentPage.categories.push(currentCatSegment);
    }
  }

  if (currentPage.categories.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

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
 * Transforms and prepares raw CRM services into grouped price list structure with table pagination.
 * Excludes archive/inactive, unifies duplicate entries representing variants of the same offer,
 * calculates category durations matrix, and paginates for A4.
 */
export function preparePriceListData(services = [], appSettings = null) {
  const language = "pl";
  const baseLabels = UI_LABELS.pl;

  // Resolve studio contacts
  const resolvedAddress =
    appSettings?.studioAddress?.trim() || STUDIO_DEFAULT_CONTACTS.address;

  const resolvedPhone =
    appSettings?.ownerNotifyPhone?.trim() || STUDIO_DEFAULT_CONTACTS.phone;

  const labels = {
    ...baseLabels,
    address: resolvedAddress,
    phone: resolvedPhone,
  };

  // 1. Filter services: automatically exclude Archive and Inactive
  const eligibleServices = services.filter((svc) => {
    if (!svc) return false;
    const status = svc.status || "Активна";
    if (status === "Архив" || status === "Неактивна") return false;
    return true;
  });

  // 2. Group by normalized category
  const groupsMap = new Map();
  const unusualPricingServices = [];

  eligibleServices.forEach((svc) => {
    const rawCat = svc.category || "Inne";
    const normCat = normalizePriceListCategory(rawCat);

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
      variants,
      minPrice,
    });
  });

  // 3. Sort categories according to canonical order
  const sortedCategoryNames = Array.from(groupsMap.keys()).sort((a, b) => {
    const idxA = PRICE_LIST_CATEGORY_ORDER.indexOf(a);
    const idxB = PRICE_LIST_CATEGORY_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // 4. Assemble clean categories and consolidate same-service variants within each category
  let totalServicesCount = 0;
  const categories = sortedCategoryNames
    .map((catName) => {
      const rawItems = groupsMap.get(catName) || [];
      if (rawItems.length === 0) return null;

      // Consolidate entries representing the same service offer (e.g. "Masaż dla dwojga" 60 min and 90 min)
      // Only merge when names match exactly and their duration variants do not collide with conflicting prices
      const consolidatedMap = new Map();

      rawItems.forEach((item) => {
        const key = item.displayName.toLowerCase().trim();
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, { ...item, variants: [...item.variants] });
        } else {
          const existing = consolidatedMap.get(key);
          // Check for variant collisions
          const existingDurations = new Set(existing.variants.map((v) => v.duration));
          const canMerge = item.variants.every((v) => !existingDurations.has(v.duration));

          if (canMerge) {
            existing.variants.push(...item.variants);
            existing.variants.sort((a, b) => a.duration - b.duration);
            existing.minPrice = Math.min(existing.minPrice, item.minPrice);
          } else {
            // If duration conflict exists (e.g. separate tier), keep separate with unique key
            consolidatedMap.set(`${key}_${item.id}`, { ...item, variants: [...item.variants] });
          }
        }
      });

      const consolidatedItems = Array.from(consolidatedMap.values());

      // Sort services inside category by minPrice, then alphabetically
      consolidatedItems.sort(
        (a, b) => a.minPrice - b.minPrice || a.displayName.localeCompare(b.displayName)
      );

      totalServicesCount += consolidatedItems.length;

      // Extract all distinct duration columns present in this category
      const durationsSet = new Set();
      consolidatedItems.forEach((s) => {
        s.variants.forEach((v) => {
          if (v.duration > 0) durationsSet.add(v.duration);
        });
      });
      const categoryDurations = Array.from(durationsSet).sort((a, b) => a - b);

      return {
        id: catName,
        rawName: catName,
        localizedName: getTranslatedCategory(catName, language),
        durations: categoryDurations,
        services: consolidatedItems,
      };
    })
    .filter(Boolean);

  // 5. Automatic A4 Pagination
  const pages = paginateCategories(categories, labels);

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
