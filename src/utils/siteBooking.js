import {siteServicesCatalog} from "../data/siteServicesCatalog.js";
import {formatAppDate, INPUT_DATE_FORMAT, parseAppDate} from "./dateUtils.js";
import {toFinanceNumber} from "./finance.js";

const SITE_MASTER_ALIASES = {
  max: "Максим",
  olha: "Ольга",
  olga: "Ольга",
  helga: "Ольга",
  максим: "Максим",
  ольга: "Ольга",
};

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");

export const normalizeSiteBookingPhone = (value) =>
  String(value ?? "").replace(/\D/g, "");

export const resolveSiteBookingMaster = (preferredMaster = "", employees = []) => {
  const raw = String(preferredMaster ?? "").trim();

  if (!raw) {
    return String(employees[0]?.name ?? "");
  }

  const alias = SITE_MASTER_ALIASES[normalizeText(raw)];

  if (alias) {
    return alias;
  }

  const matched = employees.find(
    (employee) => normalizeText(employee.name) === normalizeText(raw),
  );

  const matchedName = matched?.name ?? raw;

  return SITE_MASTER_ALIASES[normalizeText(matchedName)] || matchedName;
};

export const resolveSiteBookingService = (
  request = {},
  serviceCatalog = [],
) => {
  const slug = String(request.service_slug ?? request.serviceSlug ?? "").trim();
  const serviceName = String(request.service_name ?? request.serviceName ?? "").trim();
  const durationMinutes = Number(
    request.duration_minutes ?? request.durationMinutes ?? 60,
  );
  const catalogItem = siteServicesCatalog.find(
    (item) => normalizeText(item.slug) === normalizeText(slug),
  );
  const crmBySlug = serviceCatalog.find((service) => {
    const normalizedName = normalizeText(service.name);
    const catalogTitle = normalizeText(catalogItem?.title ?? serviceName);

    return (
      normalizedName === catalogTitle ||
      normalizeText(service.name) === normalizeText(serviceName)
    );
  });

  if (crmBySlug) {
    const variant =
      crmBySlug.variants?.find(
        (item) => Number(item.duration) === durationMinutes,
      ) ?? crmBySlug.variants?.[0];
    const amount = toFinanceNumber(variant?.price ?? crmBySlug.price ?? 0);

    if (amount > 0) {
      return {
        amount,
        duration: Number(variant?.duration ?? durationMinutes),
        service: crmBySlug.name,
        serviceId: crmBySlug.id,
      };
    }
  }

  if (catalogItem) {
    const durationIndex = catalogItem.time.findIndex(
      (minutes) => Number(minutes) === durationMinutes,
    );
    const priceIndex = durationIndex >= 0 ? durationIndex : 0;

    return {
      amount: toFinanceNumber(catalogItem.price[priceIndex] ?? 0),
      duration: Number(catalogItem.time[priceIndex] ?? durationMinutes),
      service: catalogItem.title,
      serviceId: crmBySlug?.id ?? "",
    };
  }

  return {
    amount: 0,
    duration: durationMinutes,
    service: serviceName || catalogItem?.title || "Услуга с сайта",
    serviceId: "",
  };
};

export const formatSiteBookingDateForCrm = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed) : String(value ?? "");
};

export const formatSiteBookingTimeForCrm = (value) =>
  String(value ?? "").trim().slice(0, 5);

export const formatSiteBookingInputDate = (value) => {
  const parsed = parseAppDate(value);

  return parsed ? formatAppDate(parsed, INPUT_DATE_FORMAT) : "";
};

export const summarizeSiteBookingRequest = (request = {}) => {
  const date = formatSiteBookingDateForCrm(request.preferred_date ?? request.preferredDate);
  const time = formatSiteBookingTimeForCrm(
    request.preferred_time ?? request.preferredTime,
  );

  return `${date} ${time} · ${request.service_name ?? request.serviceName ?? "Услуга"}`;
};
