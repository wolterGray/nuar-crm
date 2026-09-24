import {normalizeCalendarEntryDate} from "./dateUtils.js";

const getClampedSessionCount = (value, fallback = 0) =>
  Math.max(0, Number(value) || fallback);

const getPackageHistoryUsedVisits = (packageItem) => {
  const history = Array.isArray(packageItem?.writeOffHistory)
    ? packageItem.writeOffHistory
    : Array.isArray(packageItem?.payload?.writeOffHistory)
      ? packageItem.payload.writeOffHistory
      : [];

  if (history.length === 0) {
    return null;
  }

  const seenVisitIds = new Set();

  return history.reduce((sum, item, index) => {
    const visitKey = String(item?.visitId ?? item?.id ?? `history-${index}`);

    if (seenVisitIds.has(visitKey)) {
      return sum;
    }

    seenVisitIds.add(visitKey);
    return sum + getClampedSessionCount(item?.sessionsUsed, 1);
  }, 0);
};

export const getPackageUsedVisits = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const remaining = Number(packageItem?.remainingVisits) || 0;
  const historyUsed = getPackageHistoryUsedVisits(packageItem);
  const usedFromBalance = total - remaining;
  const used =
    historyUsed === null
      ? usedFromBalance
      : Math.max(historyUsed, usedFromBalance);

  return Math.max(0, Math.min(total, used));
};

export const getPackageProgressLabel = (packageItem, plannedVisits = 0) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const used = getPackageUsedVisits(packageItem) + (Number(plannedVisits) || 0);

  return `${Math.max(0, Math.min(total, used))}/${total}`;
};

const getPackageSessionCount = (entry) =>
  Math.max(1, Number(entry?.packageSessionsUsed) || 1);

const getPackageEntrySortValue = (entry) =>
  [
    normalizeCalendarEntryDate(entry?.date),
    String(entry?.time ?? "00:00"),
    String(entry?.id ?? ""),
  ].join("T");

export const getPackageVisitProgressLabel = (packageItem, currentEntry, entries = []) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const packageId = String(currentEntry?.packageUsageId ?? "");

  if (!total || !packageId) {
    return getPackageProgressLabel(packageItem);
  }

  const packageEntries = entries
    .filter(
      (entry) =>
        entry?.kind === "visit" &&
        String(entry.packageUsageId ?? "") === packageId &&
        !["cancelled", "no_show"].includes(entry.status),
    )
    .sort((first, second) =>
      getPackageEntrySortValue(first).localeCompare(getPackageEntrySortValue(second)),
    );
  let used = 0;

  for (const entry of packageEntries) {
    used += getPackageSessionCount(entry);

    if (String(entry.id) === String(currentEntry.id)) {
      return `${Math.max(0, Math.min(total, used))}/${total}`;
    }
  }

  return getPackageProgressLabel(
    packageItem,
    isUpcomingPackageVisit(currentEntry) ? getPackageSessionCount(currentEntry) : 0,
  );
};

export const getPackagePlannedProgressLabel = (
  packageItem,
  currentEntry,
  entries = [],
) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const packageId = String(currentEntry?.packageUsageId ?? packageItem?.id ?? "");

  if (!total || !packageId) {
    return getPackageProgressLabel(packageItem, getPackageSessionCount(currentEntry));
  }

  const currentSortValue = getPackageEntrySortValue(currentEntry);
  const plannedEntriesBeforeCurrent = entries.filter(
    (entry) =>
      entry?.kind === "visit" &&
      String(entry.packageUsageId ?? "") === packageId &&
      String(entry.id ?? "") !== String(currentEntry?.id ?? "") &&
      !["completed", "cancelled", "no_show"].includes(entry.status) &&
      getPackageEntrySortValue(entry) < currentSortValue,
  );
  const plannedBefore = plannedEntriesBeforeCurrent.reduce(
    (sum, entry) => sum + getPackageSessionCount(entry),
    0,
  );
  const currentIsAlreadyConsumed = String(currentEntry?.status ?? "") === "completed";
  const used =
    getPackageUsedVisits(packageItem) +
    plannedBefore +
    (currentIsAlreadyConsumed ? 0 : getPackageSessionCount(currentEntry));

  return `${Math.max(0, Math.min(total, used))}/${total}`;
};

export const getPackageRemainingLabel = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const remaining = Number(packageItem?.remainingVisits) || 0;

  return `${Math.max(0, Math.min(total, remaining))}/${total}`;
};

export const getPackageUsedLabel = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;

  return `${getPackageUsedVisits(packageItem)}/${total}`;
};

export const isUpcomingPackageVisit = (entry, now = new Date()) =>
  entry?.kind === "visit" &&
  Boolean(entry.packageUsageId) &&
  !["completed", "cancelled", "no_show"].includes(entry.status) &&
  new Date(`${entry.date}T${entry.time || "00:00"}:00`) >= now;
