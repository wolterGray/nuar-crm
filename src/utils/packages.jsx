import {normalizeCalendarEntryDate} from "./dateUtils.js";

export const getPackageUsedVisits = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const remaining = Number(packageItem?.remainingVisits) || 0;

  return Math.max(0, Math.min(total, total - remaining));
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

export const getPackageRemainingLabel = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const remaining = Number(packageItem?.remainingVisits) || 0;

  return `${Math.max(0, Math.min(total, remaining))}/${total}`;
};

export const isUpcomingPackageVisit = (entry, now = new Date()) =>
  entry?.kind === "visit" &&
  Boolean(entry.packageUsageId) &&
  !["completed", "cancelled", "no_show"].includes(entry.status) &&
  new Date(`${entry.date}T${entry.time || "00:00"}:00`) >= now;
