const normalizeId = (value) => String(value ?? "").trim();
const normalizeName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const getServiceAssignedEmployeeIds = (service) => {
  const ids =
    service?.assignedEmployeeIds ??
    service?.employeeIds ??
    service?.payload?.assignedEmployeeIds ??
    service?.payload?.employeeIds ??
    [];

  return Array.isArray(ids)
    ? ids.map(normalizeId).filter(Boolean)
    : [];
};

export const getServiceAssignedEmployeeNames = (service) => {
  const names =
    service?.assignedEmployeeNames ??
    service?.employeeNames ??
    service?.payload?.assignedEmployeeNames ??
    service?.payload?.employeeNames ??
    [];

  return Array.isArray(names)
    ? names.map(normalizeName).filter(Boolean)
    : [];
};

export const isServiceAssignedToEmployee = (service, employee) => {
  const assignedIds = getServiceAssignedEmployeeIds(service);
  const assignedNames = getServiceAssignedEmployeeNames(service);

  if (assignedIds.length === 0 && assignedNames.length === 0) {
    return true;
  }

  return (
    assignedIds.includes(normalizeId(employee?.id)) ||
    assignedNames.includes(normalizeName(employee?.name))
  );
};
