import {siteServicesCatalog} from "../data/siteServicesCatalog.js";
import {isSupabaseConfigured, supabase} from "../lib/supabase.js";

const SITE_CONTENT_ROW_ID = "main";

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
  const {data, error} = await supabase
    .from("site_content")
    .select("data, updated_at")
    .eq("id", SITE_CONTENT_ROW_ID)
    .maybeSingle();

  if (error) throw error;

  return {
    overrides: data?.data && typeof data.data === "object" ? data.data : {},
    updatedAt: data?.updated_at ?? null,
  };
}

async function saveSiteOverrides(overrides) {
  const {data, error} = await supabase
    .from("site_content")
    .upsert({
      id: SITE_CONTENT_ROW_ID,
      data: overrides,
      updated_at: new Date().toISOString(),
    })
    .select("updated_at")
    .single();

  if (error) throw error;
  return data?.updated_at ?? null;
}

export async function publishServicesToSite(crmServices) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase не настроен.");
  }

  const {
    data: {session},
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user?.id) {
    throw new Error("Сессия CRM не найдена. Войдите заново.");
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
