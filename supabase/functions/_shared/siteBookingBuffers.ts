import {
  findSiteCatalogItem,
  normalizeServiceText,
} from "./siteBookingCatalog.ts";

export const normalizeSiteBookingBufferSettings = (
  service: Record<string, unknown> = {},
) => ({
  afterEnabled: service.siteBookingBufferAfterEnabled === true,
  afterMinutes:
    service.siteBookingBufferAfterEnabled === true
      ? Math.max(0, Number(service.siteBookingBufferAfterMinutes) || 0)
      : 0,
  beforeEnabled: service.siteBookingBufferBeforeEnabled === true,
  beforeMinutes:
    service.siteBookingBufferBeforeEnabled === true
      ? Math.max(0, Number(service.siteBookingBufferBeforeMinutes) || 0)
      : 0,
});

export const getServiceBookingBuffers = (service: Record<string, unknown> | null) => {
  const settings = normalizeSiteBookingBufferSettings(service ?? {});

  return {
    after: settings.afterEnabled ? settings.afterMinutes : 0,
    before: settings.beforeEnabled ? settings.beforeMinutes : 0,
  };
};

export const findCatalogService = (
  serviceCatalog: Array<Record<string, unknown>> = [],
  {
    serviceId,
    serviceName,
    serviceSlug,
  }: {
    serviceId?: unknown;
    serviceName?: unknown;
    serviceSlug?: unknown;
  } = {},
) => {
  if (serviceId !== undefined && serviceId !== null && String(serviceId).trim() !== "") {
    const byId = serviceCatalog.find(
      (service) => String(service.id) === String(serviceId),
    );

    if (byId) {
      return byId;
    }
  }

  const normalizedName = normalizeServiceText(serviceName);

  if (normalizedName) {
    const byName = serviceCatalog.find(
      (service) => normalizeServiceText(service.name) === normalizedName,
    );

    if (byName) {
      return byName;
    }
  }

  const slug = normalizeServiceText(serviceSlug);

  if (!slug) {
    return null;
  }

  const catalogItem = findSiteCatalogItem(String(serviceSlug ?? ""));
  const catalogTitle = normalizeServiceText(catalogItem?.title ?? serviceName);

  return (
    serviceCatalog.find((service) => {
      const crmName = normalizeServiceText(service.name);

      return (
        (catalogTitle && crmName === catalogTitle) ||
        (normalizedName && crmName === normalizedName) ||
        (catalogTitle && crmName.includes(catalogTitle)) ||
        (catalogTitle && catalogTitle.includes(crmName))
      );
    }) ?? null
  );
};

export const extendIntervalWithServiceBuffers = (
  interval: {start: number; end: number},
  serviceCatalog: Array<Record<string, unknown>>,
  serviceQuery: {
    serviceId?: unknown;
    serviceName?: unknown;
    serviceSlug?: unknown;
  } = {},
) => {
  const buffers = getServiceBookingBuffers(
    findCatalogService(serviceCatalog, serviceQuery),
  );

  return {
    start: Math.max(0, interval.start - buffers.before),
    end: interval.end + buffers.after,
  };
};
