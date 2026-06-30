import {useCallback, useEffect, useRef, useState} from "react";
import {CLOUD_SYNC_UPDATED_AT_STORAGE_KEY} from "../constants/storageKeys.js";
import {hasCloudSnapshotConflict} from "../utils/cloudSyncConflict.js";

const CLOUD_SYNC_DEBOUNCE_MS = 60_000;
const CLOUD_SYNC_AUTO_SAVE_MAX_KB = 500;

const getCloudUpdatedAtCache = () => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CLOUD_SYNC_UPDATED_AT_STORAGE_KEY) ?? "{}",
    );

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const setCachedCloudUpdatedAt = (userId, updatedAt) => {
  if (!userId || !updatedAt) {
    return;
  }

  const cache = getCloudUpdatedAtCache();
  cache[userId] = updatedAt;
  window.localStorage.setItem(
    CLOUD_SYNC_UPDATED_AT_STORAGE_KEY,
    JSON.stringify(cache),
  );
};

const serializeSnapshot = (snapshot) => {
  try {
    return JSON.stringify(snapshot ?? {});
  } catch {
    return "";
  }
};

const measureSnapshot = (snapshot) => {
  const snapshotJson = serializeSnapshot(snapshot);
  const sizeBytes =
    typeof Blob === "undefined"
      ? new TextEncoder().encode(snapshotJson).length
      : new Blob([snapshotJson]).size;

  return {
    sizeKb: Math.round(sizeBytes / 1024),
    snapshotJson,
  };
};

export function useCloudSync({
  supabase,
  userId,
  cloudSnapshot,
  cloudSnapshotRef,
  onApplySnapshot,
  onConflictDetected,
}) {
  const lastKnownServerUpdatedAtRef = useRef("");
  const lastSavedSnapshotJsonRef = useRef("");
  const skipNextAutosaveRef = useRef(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState("");
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [lastCloudSyncError, setLastCloudSyncError] = useState("");
  const [cloudConflict, setCloudConflict] = useState(null);

  const rememberServerUpdatedAt = useCallback((value) => {
    if (!value) {
      return;
    }

    lastKnownServerUpdatedAtRef.current = value;
    setCachedCloudUpdatedAt(userId, value);
    setLastCloudSyncAt(value);
  }, [userId]);

  const fetchRemoteSnapshotMeta = useCallback(async () => {
    if (!supabase || !userId) {
      throw new Error("Облако недоступно");
    }

    const {data, error} = await supabase
      .from("crm_snapshots")
      .select("updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }, [supabase, userId]);

  const fetchRemoteSnapshot = useCallback(async () => {
    if (!supabase || !userId) {
      throw new Error("Облако недоступно");
    }

    const {data, error} = await supabase
      .from("crm_snapshots")
      .select("payload, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }, [supabase, userId]);

  const saveSnapshot = useCallback(
    async ({auto = false, force = false} = {}) => {
      if (!supabase || !userId) {
        throw new Error("Облако недоступно");
      }

      const {sizeKb, snapshotJson} = measureSnapshot(cloudSnapshotRef.current);
      console.log("[cloud-sync] snapshot size:", sizeKb, "KB");

      if (auto && sizeKb > CLOUD_SYNC_AUTO_SAVE_MAX_KB) {
        console.warn(
          `[cloud-sync] auto save skipped: snapshot size ${sizeKb} KB exceeds ${CLOUD_SYNC_AUTO_SAVE_MAX_KB} KB`,
        );
        return lastKnownServerUpdatedAtRef.current;
      }

      if (!force && snapshotJson && snapshotJson === lastSavedSnapshotJsonRef.current) {
        return lastKnownServerUpdatedAtRef.current;
      }

      const remote = await fetchRemoteSnapshotMeta();

      if (
        !force &&
        hasCloudSnapshotConflict(
          lastKnownServerUpdatedAtRef.current,
          remote?.updated_at,
        )
      ) {
        setCloudConflict({remoteUpdatedAt: remote.updated_at});
        setLastCloudSyncError("Облако обновилось на другом устройстве");
        onConflictDetected?.(remote.updated_at);
        throw new Error("Облако обновилось на другом устройстве");
      }

      const syncedAt = new Date().toISOString();
      const {error} = await supabase.from("crm_snapshots").upsert({
        payload: cloudSnapshotRef.current,
        updated_at: syncedAt,
        user_id: userId,
      });

      if (error) {
        throw error;
      }

      rememberServerUpdatedAt(syncedAt);
      lastSavedSnapshotJsonRef.current = snapshotJson;
      setCloudConflict(null);
      setLastCloudSyncError("");

      return syncedAt;
    },
    [
      cloudSnapshotRef,
      fetchRemoteSnapshotMeta,
      onConflictDetected,
      rememberServerUpdatedAt,
      supabase,
      userId,
    ],
  );

  const forceCloudSave = useCallback(async () => {
    if (!cloudHydrated) {
      throw new Error("Дождитесь загрузки данных из облака");
    }

    setCloudSyncing(true);

    try {
      return await saveSnapshot();
    } catch (error) {
      if (error?.message !== "Облако обновилось на другом устройстве") {
        const message = error?.message || "Не удалось сохранить в облако";
        setLastCloudSyncError(message);
      }
      throw error;
    } finally {
      setCloudSyncing(false);
    }
  }, [cloudHydrated, saveSnapshot]);

  const manualCloudRestore = useCallback(async () => {
    setCloudSyncing(true);

    try {
      const remote = await fetchRemoteSnapshot();

      if (remote?.payload && Object.keys(remote.payload).length > 0) {
        onApplySnapshot(remote.payload);
        lastSavedSnapshotJsonRef.current = serializeSnapshot(remote.payload);
      }

      if (remote?.updated_at) {
        rememberServerUpdatedAt(remote.updated_at);
      }

      setCloudConflict(null);
      setLastCloudSyncError("");

      return remote;
    } catch (error) {
      const message = error?.message || "Не удалось загрузить данные из облака";
      setLastCloudSyncError(message);
      throw error;
    } finally {
      setCloudSyncing(false);
    }
  }, [fetchRemoteSnapshot, onApplySnapshot, rememberServerUpdatedAt]);

  const overwriteRemoteSnapshot = useCallback(async () => {
    setCloudSyncing(true);

    try {
      return await saveSnapshot({force: true});
    } catch (error) {
      const message = error?.message || "Не удалось перезаписать облако";
      setLastCloudSyncError(message);
      throw error;
    } finally {
      setCloudSyncing(false);
    }
  }, [saveSnapshot]);

  const resetCloudSyncState = useCallback(() => {
    lastKnownServerUpdatedAtRef.current = "";
    lastSavedSnapshotJsonRef.current = "";
    skipNextAutosaveRef.current = false;
    setCloudHydrated(false);
    setCloudLoadError("");
    setLastCloudSyncAt("");
    setLastCloudSyncError("");
    setCloudConflict(null);
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      return undefined;
    }

    let active = true;

    const hydrate = async () => {
      try {
        const remoteMeta = await fetchRemoteSnapshotMeta();

        if (!active) {
          return;
        }

        if (remoteMeta?.updated_at) {
          rememberServerUpdatedAt(remoteMeta.updated_at);
        }

        lastSavedSnapshotJsonRef.current = serializeSnapshot(
          cloudSnapshotRef.current,
        );
        skipNextAutosaveRef.current = true;
        setCloudHydrated(true);
        setCloudLoadError("");
        setCloudConflict(null);
      } catch (error) {
        if (active) {
          setCloudLoadError(error?.message || "Не удалось загрузить данные из облака");
        }
      }
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [
    cloudSnapshotRef,
    fetchRemoteSnapshotMeta,
    rememberServerUpdatedAt,
    supabase,
    userId,
  ]);

  useEffect(() => {
    if (!supabase || !userId || !cloudHydrated || cloudConflict) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      if (skipNextAutosaveRef.current) {
        skipNextAutosaveRef.current = false;
        return;
      }

      try {
        await saveSnapshot({auto: true});
      } catch (error) {
        if (
          error?.message !== "Облако обновилось на другом устройстве" &&
          !cloudConflict
        ) {
          setLastCloudSyncError(
            error?.message || "Не удалось автоматически сохранить в облако",
          );
        }
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    cloudConflict,
    cloudHydrated,
    cloudSnapshot,
    saveSnapshot,
    supabase,
    userId,
  ]);

  return {
    cloudConflict,
    cloudHydrated,
    cloudLoadError,
    cloudSyncing,
    forceCloudSave,
    lastCloudSyncAt,
    lastCloudSyncError,
    manualCloudRestore,
    overwriteRemoteSnapshot,
    resetCloudSyncState,
    setCloudHydrated,
    setCloudLoadError,
  };
};
