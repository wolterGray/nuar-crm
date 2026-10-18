import { normalizeCategory, CANONICAL_CATEGORIES } from "./serviceCategories.js";
import {
  getTranslatedCategory,
  getTranslatedService,
  UI_LABELS,
  STUDIO_DEFAULT_CONTACTS,
} from "./priceListTranslations.js";

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
 * Formats duration and price summary string
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
 * Fixed A4 page height budget in relative units
 */
export const A4_PAGE_CAPACITY = 920;

/**
 * Calculates item weight for deterministic pagination
 */
function getItemWeight(service) {
  const variantCount = service.variants?.length || 1;
  // Multi-variant services occupy slightly more vertical height
  if (variantCount <= 1) return 26;
  if (variantCount <= 3) return 36;
  return 46;
}

/**
 * Splits categorized services into balanced A4 pages without awkward breaks
 */
export function paginateCategories(categories, labels = UI_LABELS.pl) {
  const maxCapacity = A4_PAGE_CAPACITY;

  const headerWeight = 78;
  const subHeaderWeight = 36;
  const footerWeight = 32;
  const catHeaderWeight = 26;

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
      const svcWeight = getItemWeight(svc);
      const neededWeight = svcWeight + (!catHeaderAdded ? catHeaderWeight : 0);

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
 * Always uses Polish language, automatically excludes archive and inactive services.
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
    const normCat = normalizeCategory(rawCat);

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
      formattedPrice: formatVariantsSummary(variants, "full", language),
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

  // 4. Assemble clean categories and sort services within each category
  let totalServicesCount = 0;
  const categories = sortedCategoryNames
    .map((catName) => {
      const items = groupsMap.get(catName) || [];
      if (items.length === 0) return null;

      // Sort services inside category by minPrice, then alphabetically
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
