import {siteServicesCatalog} from "./siteServicesCatalog.ts";

export const normalizeServiceText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replaceAll("ł", "l")
    .replaceAll("ó", "o")
    .replaceAll("ą", "a")
    .replaceAll("ę", "e")
    .replaceAll("ś", "s")
    .replaceAll("ć", "c")
    .replaceAll("ń", "n")
    .replaceAll("ż", "z")
    .replaceAll("ź", "z");

export const findSiteCatalogItem = (serviceSlug = "") => {
  const slug = normalizeServiceText(serviceSlug);

  if (!slug) {
    return null;
  }

  return (
    siteServicesCatalog.find(
      (item) => normalizeServiceText(item.slug) === slug,
    ) ?? null
  );
};

export const resolveSiteCatalogPrice = ({
  durationMinutes,
  serviceSlug = "",
}: {
  durationMinutes: number;
  serviceSlug?: string;
}) => {
  const catalogItem = findSiteCatalogItem(serviceSlug);

  if (!catalogItem) {
    return 0;
  }

  const durationIndex = catalogItem.time.findIndex(
    (minutes) => Number(minutes) === Number(durationMinutes),
  );
  const priceIndex = durationIndex >= 0 ? durationIndex : 0;

  return Math.max(0, Math.round(Number(catalogItem.price[priceIndex] ?? 0)));
};

export const resolveSiteBookingBasePrice = ({
  durationMinutes,
  serviceCatalog = [],
  serviceName = "",
  serviceSlug = "",
}: {
  durationMinutes: number;
  serviceCatalog?: Array<Record<string, unknown>>;
  serviceName?: string;
  serviceSlug?: string;
}) => {
  const catalogItem = findSiteCatalogItem(serviceSlug);
  const catalogTitle = normalizeServiceText(catalogItem?.title ?? "");
  const normalizedName = normalizeServiceText(serviceName);
  const crmService = serviceCatalog.find((service) => {
    const crmName = normalizeServiceText(service.name);

    return (
      (catalogTitle && crmName === catalogTitle) ||
      (normalizedName && crmName === normalizedName) ||
      (catalogTitle && crmName.includes(catalogTitle)) ||
      (catalogTitle && catalogTitle.includes(crmName))
    );
  });

  if (crmService) {
    const variants = crmService.variants as
      | Array<Record<string, unknown>>
      | undefined;
    const variant =
      variants?.find(
        (item) => Number(item.duration) === Number(durationMinutes),
      ) ?? variants?.[0];
    const crmPrice = Math.round(
      Number(variant?.price ?? crmService.price ?? 0),
    );

    if (crmPrice > 0) {
      return crmPrice;
    }
  }

  return resolveSiteCatalogPrice({durationMinutes, serviceSlug});
};
