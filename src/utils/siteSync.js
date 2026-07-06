import {siteServicesCatalog} from "../data/siteServicesCatalog.js";
import {API_URL} from "../api/config.js";
import {getAuthToken, notifyAuthTokenRejected} from "../hooks/useAuth.js";

const SITE_OVERRIDES_CACHE_TTL_MS = 60_000;

let siteOverridesCache = null;

const CRM_NAME_ALIASES = {
  "masaz drenaz limfatyczny": "masaz limfatyczny",
  "masz twarzy i glowy": "masaz twarzy i glowy",
};

function normalizeServiceName(value = "") {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function resolveSiteName(crmName) {
  const normalized = normalizeServiceName(crmName);
  return CRM_NAME_ALIASES[normalized] ?? normalized;
}

export function mapCrmServicesToSite(crmServices, baseServices) {
  if (!Array.isArray(crmServices) || crmServices.length === 0) {
    throw new Error("В CRM нет услуг для публикации на сайте.");
  }

  const crmByName = new Map(
    crmServices.map((service) => [resolveSiteName(service.name), service]),
  );

  const merged = baseServices.map((siteService) => {
    const crmService = crmByName.get(normalizeServiceName(siteService.title));
    if (!crmService?.variants?.length) return siteService;

    return {
      ...siteService,
      time: crmService.variants.map((variant) => variant.duration),
      price: crmService.variants.map((variant) => variant.price),
    };
  });

  const matched = merged.filter((service, index) => {
    const crmService = crmByName.get(
      normalizeServiceName(baseServices[index].title),
    );
    return Boolean(crmService?.variants?.length);
  }).length;

  return {services: merged, matched, total: baseServices.length};
}

async function fetchSiteOverrides() {
  if (
    siteOverridesCache &&
    Date.now() - siteOverridesCache.cachedAt < SITE_OVERRIDES_CACHE_TTL_MS
  ) {
    return siteOverridesCache.data;
  }

  const response = await fetch(`${API_URL}/api/public/site-content`, {
    headers: {"Content-Type": "application/json"},
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || "Не удалось загрузить контент сайта.");
  }

  const remote = {
    overrides:
      payload?.data?.overrides && typeof payload.data.overrides === "object"
        ? payload.data.overrides
        : {},
    updatedAt: payload?.data?.updatedAt ?? null,
  };

  siteOverridesCache = {
    cachedAt: Date.now(),
    data: remote,
  };

  return remote;
}

async function saveSiteOverrides(overrides) {
  const token = await getAuthToken?.();

  if (!token) {
    throw new Error("Сессия CRM не найдена. Войдите заново.");
  }

  const response = await fetch(`${API_URL}/api/site-content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({overrides}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    if (response.status === 401) {
      notifyAuthTokenRejected();
    }
    throw new Error(payload?.error || payload?.message || "Не удалось сохранить контент сайта.");
  }

  const updatedAt = payload?.data?.updatedAt ?? null;

  siteOverridesCache = {
    cachedAt: Date.now(),
    data: {
      overrides,
      updatedAt,
    },
  };

  return updatedAt;
}

export async function publishServicesToSite(crmServices) {
  if (!API_URL) {
    throw new Error("Backend не настроен.");
  }

  const remote = await fetchSiteOverrides();
  const baseServices = Array.isArray(remote.overrides.services)
    ? remote.overrides.services
    : siteServicesCatalog;

  const result = mapCrmServicesToSite(crmServices, baseServices);
  const nextOverrides = {
    ...remote.overrides,
    services: result.services,
  };

  const savedAt = await saveSiteOverrides(nextOverrides);

  return {
    ...result,
    savedAt,
    previousSiteUpdate: remote.updatedAt,
  };
}
