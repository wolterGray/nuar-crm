export const ARCHIVED_CLIENT_PACKAGE_STATUSES = new Set(["Архив", "Закончился"]);

export const isArchivedClientPackage = (packageItem) => {
  if (!packageItem) {
    return true;
  }

  const status = String(packageItem.status ?? "");

  if (ARCHIVED_CLIENT_PACKAGE_STATUSES.has(status)) {
    return true;
  }

  return (Number(packageItem.remainingVisits) || 0) <= 0;
};

export const isActiveClientPackage = (packageItem) =>
  !isArchivedClientPackage(packageItem);

export const resolveClientPackageStatus = (
  remainingVisits,
  status = "Активен",
) => {
  const remaining = Number(remainingVisits) || 0;
  const normalizedStatus = String(status ?? "Активен");

  if (remaining <= 0) {
    return "Архив";
  }

  if (ARCHIVED_CLIENT_PACKAGE_STATUSES.has(normalizedStatus)) {
    return "Активен";
  }

  return normalizedStatus;
};

export const syncClientPackageStatus = (packageItem) => ({
  ...packageItem,
  status: resolveClientPackageStatus(
    packageItem.remainingVisits,
    packageItem.status,
  ),
});
