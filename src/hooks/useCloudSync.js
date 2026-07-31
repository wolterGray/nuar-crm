import {useCallback} from "react";

const CLOUD_SYNC_DISABLED_MESSAGE =
  "Ручная облачная синхронизация отключена: CRM сохраняет данные через сервер Hetzner.";

const noop = () => {};

export function useCloudSync() {
  const disabledAction = useCallback(async () => {
    throw new Error(CLOUD_SYNC_DISABLED_MESSAGE);
  }, []);

  return {
    cloudConflict: null,
    cloudHydrated: true,
    cloudLoadError: "",
    cloudSyncing: false,
    forceCloudSave: disabledAction,
    lastCloudSyncAt: "",
    lastCloudSyncError: "",
    manualCloudRestore: disabledAction,
    overwriteRemoteSnapshot: disabledAction,
    resetCloudSyncState: noop,
    setCloudHydrated: noop,
    setCloudLoadError: noop,
  };
}
