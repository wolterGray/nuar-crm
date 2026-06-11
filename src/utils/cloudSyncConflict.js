export const hasCloudSnapshotConflict = (knownUpdatedAt, remoteUpdatedAt) => {
  if (!knownUpdatedAt || !remoteUpdatedAt) {
    return false;
  }

  const knownTime = new Date(knownUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  if (!Number.isFinite(knownTime) || !Number.isFinite(remoteTime)) {
    return false;
  }

  return remoteTime > knownTime;
};
