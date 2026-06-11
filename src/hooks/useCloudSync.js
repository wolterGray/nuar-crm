import {useCallback, useEffect, useRef, useState} from "react";
import {hasCloudSnapshotConflict} from "../utils/cloudSyncConflict.js";

const CLOUD_SYNC_DEBOUNCE_MS = 900;

export function useCloudSync({
  supabase,
  userId,
  cloudSnapshot,
  cloudSnapshotRef,
  onApplySnapshot,
  onConflictDetected,
}) {
  const lastKnownServerUpdatedAtRef = useRef("");
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
    setLastCloudSyncAt(value);
  }, []);

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
    async ({force = false} = {}) => {
      if (!supabase || !userId) {
        throw new Error("Облако недоступно");
      }

      const remote = await fetchRemoteSnapshot();

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
      setCloudConflict(null);
      setLastCloudSyncError("");

      return syncedAt;
    },
    [
      cloudSnapshotRef,
      fetchRemoteSnapshot,
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

  const applyRemoteSnapshot = useCallback(async () => {
    setCloudSyncing(true);

    try {
      const remote = await fetchRemoteSnapshot();

      if (remote?.payload && Object.keys(remote.payload).length > 0) {
        onApplySnapshot(remote.payload);
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
      const {data, error} = await supabase
        .from("crm_snapshots")
        .select("payload, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        setCloudLoadError(error.message);
        return;
      }

      if (data?.payload && Object.keys(data.payload).length > 0) {
        onApplySnapshot(data.payload);
        rememberServerUpdatedAt(data.updated_at);
      } else {
        const syncedAt = new Date().toISOString();
        const {error: saveError} = await supabase.from("crm_snapshots").upsert({
          payload: cloudSnapshotRef.current,
          updated_at: syncedAt,
          user_id: userId,
        });

        if (saveError) {
          setCloudLoadError(saveError.message);
          return;
        }

        rememberServerUpdatedAt(syncedAt);
      }

      setCloudHydrated(true);
      setCloudLoadError("");
      setCloudConflict(null);
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [
    cloudSnapshotRef,
    onApplySnapshot,
    rememberServerUpdatedAt,
    supabase,
    userId,
  ]);

  useEffect(() => {
    if (!supabase || !userId || !cloudHydrated || cloudConflict) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        await saveSnapshot();
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
    applyRemoteSnapshot,
    cloudConflict,
    cloudHydrated,
    cloudLoadError,
    cloudSyncing,
    forceCloudSave,
    lastCloudSyncAt,
    lastCloudSyncError,
    overwriteRemoteSnapshot,
    resetCloudSyncState,
    setCloudHydrated,
    setCloudLoadError,
  };
};
