const normalizeEmployeeName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('ё', 'е');

const objectPayload = (record) =>
  record?.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
    ? record.payload
    : {};

const getEmployeeNames = (employee) => {
  const payload = objectPayload(employee);
  return new Set(
    [employee?.name, payload.name, ...(Array.isArray(payload.aliases) ? payload.aliases : [])]
      .map(normalizeEmployeeName)
      .filter(Boolean),
  );
};

const recordBelongsToEmployee = (record, employee) => {
  if (!record || !employee) return false;
  const payload = objectPayload(record);
  const employeeId = Number(employee.id);
  const assignedIds = [
    record.employeeId,
    record.masterId,
    payload.employeeId,
    payload.masterId,
    payload.staffId,
  ]
    .map(Number)
    .filter(Number.isInteger);

  if (assignedIds.includes(employeeId)) return true;

  const names = getEmployeeNames(employee);
  return [record.master, record.masterName, record.employeeName, payload.master, payload.masterName, payload.employeeName]
    .map(normalizeEmployeeName)
    .filter(Boolean)
    .some((name) => names.has(name));
};

const resolveScopedEmployee = async (prisma, auth) => {
  const employeeId = Number(auth?.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) return null;
  return prisma.employee.findUnique({where: {id: employeeId}});
};

const findScopedClientIds = async (prisma, employee) => {
  if (!employee) return [];
  const [visits, calendarEntries] = await Promise.all([
    prisma.visit.findMany({select: {clientId: true, employeeId: true, payload: true}}),
    prisma.calendarEntry.findMany({select: {payload: true}}),
  ]);
  const clientIds = new Set();

  for (const record of [...visits, ...calendarEntries]) {
    if (!recordBelongsToEmployee(record, employee)) continue;
    const payload = objectPayload(record);
    const clientId = Number(record.clientId ?? payload.clientId);
    if (Number.isInteger(clientId) && clientId > 0) clientIds.add(clientId);
  }

  return [...clientIds];
};

const getScopedClientIds = async (prisma, auth) => {
  const employee = await resolveScopedEmployee(prisma, auth);
  return findScopedClientIds(prisma, employee);
};

const serviceIsAssignedToEmployee = (service, employee) => {
  if (!service || !employee) return false;
  const payload = objectPayload(service);
  const employeeServices = Array.isArray(employee.services) ? employee.services.map(String) : [];
  const assignedIds = Array.isArray(payload.assignedEmployeeIds)
    ? payload.assignedEmployeeIds.map(String)
    : [];
  const assignedNames = Array.isArray(payload.assignedEmployeeNames)
    ? payload.assignedEmployeeNames.map(normalizeEmployeeName)
    : [];
  const employeeNames = getEmployeeNames(employee);

  return (
    employeeServices.includes(String(service.id)) ||
    assignedIds.includes(String(employee.id)) ||
    assignedNames.some((name) => employeeNames.has(name))
  );
};

module.exports = {
  findScopedClientIds,
  getScopedClientIds,
  normalizeEmployeeName,
  recordBelongsToEmployee,
  resolveScopedEmployee,
  serviceIsAssignedToEmployee,
};
