export const getPackageUsedVisits = (packageItem) => {
  const total = Number(packageItem?.totalVisits) || 0;
  const remaining = Number(packageItem?.remainingVisits) || 0;

  return Math.max(0, Math.min(total, total - remaining));
};

export const getPackageProgressLabel = (packageItem) =>
  `${getPackageUsedVisits(packageItem)}/${Number(packageItem?.totalVisits) || 0}`;
