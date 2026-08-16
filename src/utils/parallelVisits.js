export const isParallelService = (service) =>
  Boolean(service?.isParallel ?? service?.payload?.isParallel);

export const getParallelParticipantCount = (service) =>
  isParallelService(service)
    ? Math.max(2, Number(service?.parallelParticipants ?? service?.payload?.parallelParticipants) || 2)
    : 1;

export const getParallelParticipantPrices = (service, duration) => {
  const count = getParallelParticipantCount(service);
  const variant = service?.variants?.find(
    (item) => Number(item?.duration) === Number(duration),
  );
  const rawPrices = Array.isArray(variant?.participantPrices)
    ? variant.participantPrices
    : Array.isArray(variant?.parallelParticipantPrices)
      ? variant.parallelParticipantPrices
      : [];
  const prices = rawPrices
    .slice(0, count)
    .map((price) => Math.max(0, Number(price) || 0));

  if (prices.length === count && prices.some((price) => price > 0)) {
    return prices;
  }

  const total = Math.max(0, Number(variant?.price) || 0);
  const share = count > 0 ? Math.round((total / count) * 100) / 100 : total;

  return Array.from({length: count}, () => share);
};

export const getParallelParticipantTotal = (service, duration) =>
  getParallelParticipantPrices(service, duration).reduce(
    (total, price) => total + price,
    0,
  );

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
