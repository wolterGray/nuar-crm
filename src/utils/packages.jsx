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
