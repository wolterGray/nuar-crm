import {siteServicesCatalog} from "../data/siteServicesCatalog.js";

const normalizeServiceText = (value) =>
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

export const normalizeSiteBookingBufferSettings = (service = {}) => ({
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

export const getServiceBookingBuffers = (service) => {
  const settings = normalizeSiteBookingBufferSettings(service ?? {});

  return {
    after: settings.afterEnabled ? settings.afterMinutes : 0,
    before: settings.beforeEnabled ? settings.beforeMinutes : 0,
  };
};

export const findCatalogService = (
  serviceCatalog = [],
  {serviceId, serviceName, serviceSlug} = {},
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

  const catalogItem = siteServicesCatalog.find(
    (item) => normalizeServiceText(item.slug) === slug,
  );
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
  interval,
  serviceCatalog,
  serviceQuery = {},
) => {
  const buffers = getServiceBookingBuffers(
    findCatalogService(serviceCatalog, serviceQuery),
  );

  return {
    start: Math.max(0, interval.start - buffers.before),
    end: interval.end + buffers.after,
  };
};

export const parseServiceBookingBuffersFromForm = (form, editingService = null) => ({
  siteBookingBufferAfterEnabled: form.get("siteBookingBufferAfterEnabled") === "on",
  siteBookingBufferAfterMinutes: Math.max(
    0,
    Number(form.get("siteBookingBufferAfterMinutes")) ||
      Number(editingService?.siteBookingBufferAfterMinutes) ||
      0,
  ),
  siteBookingBufferBeforeEnabled: form.get("siteBookingBufferBeforeEnabled") === "on",
  siteBookingBufferBeforeMinutes: Math.max(
    0,
    Number(form.get("siteBookingBufferBeforeMinutes")) ||
      Number(editingService?.siteBookingBufferBeforeMinutes) ||
      0,
  ),
});
