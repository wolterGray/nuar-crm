export const isParallelService = (service) =>
  Boolean(service?.isParallel ?? service?.payload?.isParallel);

export const getParallelParticipantCount = (service) =>
  isParallelService(service)
    ? Math.max(2, Number(service?.parallelParticipants ?? service?.payload?.parallelParticipants) || 2)
    : 1;

export const getEntryMasters = (entry) => {
  const participants = Array.isArray(entry?.parallelEmployees)
    ? entry.parallelEmployees
    : Array.isArray(entry?.payload?.parallelEmployees)
      ? entry.payload.parallelEmployees
      : [];
  const names = participants
    .map((participant) => String(participant?.name ?? participant?.master ?? "").trim())
    .filter(Boolean);
  const secondaryMaster = String(entry?.secondaryMaster ?? entry?.payload?.secondaryMaster ?? "").trim();
  if (secondaryMaster) names.push(secondaryMaster);
  if (entry?.master) names.unshift(String(entry.master).trim());

  return [...new Set(names.filter(Boolean))];
};

export const isEntryForMaster = (entry, masterName) =>
  getEntryMasters(entry).includes(masterName);
