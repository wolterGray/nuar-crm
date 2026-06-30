import {createAdminClient} from "./supabaseAdmin.ts";

export type CrmSnapshotPayload = {
  calendarEntries?: Array<Record<string, unknown>>;
  employees?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
};

const hasSnapshotData = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as CrmSnapshotPayload;

  return (
    (record.calendarEntries?.length ?? 0) > 0 ||
    (record.employees?.length ?? 0) > 0 ||
    Object.keys(record.settings ?? {}).length > 0
  );
};

type SiteBookingSnapshot = {
  ownerUserId: string;
  payload: CrmSnapshotPayload;
};

let siteBookingSnapshotCache:
  | {
      cachedAt: number;
      data: SiteBookingSnapshot;
    }
  | null = null;

export const loadCrmSnapshotForSiteBooking = async (
  admin: ReturnType<typeof createAdminClient>,
  {cacheTtlMs = 0}: {cacheTtlMs?: number} = {},
) => {
  if (
    cacheTtlMs > 0 &&
    siteBookingSnapshotCache &&
    Date.now() - siteBookingSnapshotCache.cachedAt < cacheTtlMs
  ) {
    return siteBookingSnapshotCache.data;
  }

  const configuredOwnerId = String(Deno.env.get("CRM_OWNER_USER_ID") ?? "").trim();

  if (configuredOwnerId) {
    const {data, error} = await admin
      .from("crm_snapshots")
      .select("user_id, payload")
      .eq("user_id", configuredOwnerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.payload && hasSnapshotData(data.payload)) {
      const snapshot = {
        ownerUserId: configuredOwnerId,
        payload: data.payload as CrmSnapshotPayload,
      };

      if (cacheTtlMs > 0) {
        siteBookingSnapshotCache = {cachedAt: Date.now(), data: snapshot};
      }

      return snapshot;
    }
  }

  const {data, error} = await admin
    .from("crm_snapshots")
    .select("user_id, payload")
    .order("updated_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.user_id) {
    throw new Error("CRM snapshot not found");
  }

  const snapshot = {
    ownerUserId: data.user_id,
    payload: (data.payload ?? {}) as CrmSnapshotPayload,
  };

  if (cacheTtlMs > 0) {
    siteBookingSnapshotCache = {cachedAt: Date.now(), data: snapshot};
  }

  return snapshot;
};
