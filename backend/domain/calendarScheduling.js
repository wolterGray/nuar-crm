const normalizeMaster = (value) => String(value ?? '').trim().toLocaleLowerCase('pl');

const getEntryPayload = (entry) =>
  entry?.payload && typeof entry.payload === 'object' && !Array.isArray(entry.payload)
    ? entry.payload
    : {};

const getEntryMasters = (entry) => {
  const payload = getEntryPayload(entry);
  const participants = Array.isArray(entry?.parallelEmployees)
    ? entry.parallelEmployees
    : Array.isArray(payload.parallelEmployees)
      ? payload.parallelEmployees
      : [];
  const names = participants.map((participant) => participant?.name ?? participant?.master);
  names.push(
    entry?.master ?? payload.master,
    entry?.secondaryMaster ?? payload.secondaryMaster,
    entry?.secondMaster ?? payload.secondMaster,
    entry?.parallelMaster ?? payload.parallelMaster,
  );
  return [...new Set(names.map(normalizeMaster).filter(Boolean))];
};

const toMinutes = (value) => {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getEntryInterval = (entry) => {
  const payload = getEntryPayload(entry);
  const start = toMinutes(entry?.time ?? payload.time);
  if (start === null) return null;
  const duration = Math.max(15, Number(entry?.duration ?? payload.duration) || 60);
  return {end: start + duration, start};
};

const isActiveCalendarEntry = (entry) =>
  !['cancelled', 'canceled', 'no_show'].includes(String(entry?.status ?? '').trim().toLowerCase());

const findCalendarConflicts = (candidate, entries, excludeId = null) => {
  const candidateInterval = getEntryInterval(candidate);
  const candidateMasters = getEntryMasters(candidate);
  if (!candidateInterval || candidateMasters.length === 0) return [];

  return entries.filter((entry) => {
    if (String(entry?.id) === String(excludeId)) return false;
    if (String(entry?.date ?? '') !== String(candidate?.date ?? '')) return false;
    if (!isActiveCalendarEntry(entry)) return false;
    if (!getEntryMasters(entry).some((master) => candidateMasters.includes(master))) return false;
    const interval = getEntryInterval(entry);
    return interval && candidateInterval.start < interval.end && candidateInterval.end > interval.start;
  });
};

const getCalendarLockKeys = (entry) =>
  getEntryMasters(entry)
    .map((master) => ['calendar', String(entry?.date ?? '').trim(), master].join(':'))
    .sort();

module.exports = {
  findCalendarConflicts,
  getCalendarLockKeys,
  getEntryInterval,
  getEntryMasters,
};
