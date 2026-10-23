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
    .filter((id) => Number.isInteger(id) && id > 0);

  const secondaryIds = [
    record.secondaryEmployeeId,
    record.secondMasterId,
    payload.secondaryEmployeeId,
    payload.secondMasterId,
    ...(Array.isArray(payload.parallelMasters)
      ? payload.parallelMasters.map((m) => m?.employeeId ?? m?.id)
      : []),
  ]
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (assignedIds.includes(employeeId) || secondaryIds.includes(employeeId)) return true;

  const names = getEmployeeNames(employee);
  const secondaryNames = [
    record.secondaryMaster,
    record.secondMaster,
    payload.secondaryMaster,
    payload.secondMaster,
    ...(Array.isArray(payload.parallelMasters)
      ? payload.parallelMasters.map((m) => (typeof m === 'string' ? m : m?.name ?? m?.master))
      : []),
  ]
    .map(normalizeEmployeeName)
    .filter(Boolean);

  if (secondaryNames.some((name) => names.has(name))) return true;

  // If an explicit primary employeeId is present and did not match, do not fall back to primary name matching
  if (assignedIds.length > 0) return false;

  return [
    record.master,
    record.masterName,
    record.employeeName,
    payload.master,
    payload.masterName,
    payload.employeeName,
  ]
    .map(normalizeEmployeeName)
    .filter(Boolean)
    .some((name) => names.has(name));
};

const resolveScopedEmployee = async (prisma, auth) => {
  const employeeId = Number(auth?.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) return null;
  return prisma.employee.findUnique({where: {id: employeeId}});
};

const findScopedClientIds = async (prisma, employee, auth = null) => {
  if (!employee) return [];
  const actorIds = [auth?.sub, auth?.id, auth?.email]
    .filter((val) => val !== undefined && val !== null && String(val).trim() !== '')
    .map(String);

  const [visits, calendarEntries, createdClientLogs] = await Promise.all([
    prisma.visit.findMany({select: {clientId: true, employeeId: true, payload: true}}),
    prisma.calendarEntry.findMany({select: {payload: true}}),
    actorIds.length > 0 && typeof prisma?.auditLog?.findMany === 'function'
      ? prisma.auditLog
          .findMany({
            where: {
              entity: 'Client',
              action: 'create client',
              actorId: {in: actorIds},
            },
            select: {entityId: true},
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const clientIds = new Set();

  for (const record of [...visits, ...calendarEntries]) {
    if (!recordBelongsToEmployee(record, employee)) continue;
    const payload = objectPayload(record);
    const clientId = Number(record.clientId ?? payload.clientId);
    if (Number.isInteger(clientId) && clientId > 0) clientIds.add(clientId);
  }

  for (const log of createdClientLogs || []) {
    const clientId = Number(log?.entityId);
    if (Number.isInteger(clientId) && clientId > 0) clientIds.add(clientId);
  }

  return [...clientIds];
};

const getScopedClientIds = async (prisma, auth) => {
  const employee = await resolveScopedEmployee(prisma, auth);
  return findScopedClientIds(prisma, employee, auth);
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
