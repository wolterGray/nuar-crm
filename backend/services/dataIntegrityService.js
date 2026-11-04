const MAX_SAMPLES = 20;

const sample = (items) => items.slice(0, MAX_SAMPLES);

async function checkDataIntegrity(prisma) {
  const [visits, calendarEntries, packages, certificates] = await Promise.all([
    prisma.visit.findMany({
      where: {calendarEntryId: {not: null}},
      select: {calendarEntryId: true, id: true},
    }),
    prisma.calendarEntry.findMany({
      select: {id: true, status: true, visitId: true},
    }),
    prisma.clientPackage.findMany({
      select: {id: true, remainingVisits: true, totalVisits: true},
    }),
    prisma.certificate.findMany({
      select: {id: true, nominal: true, remainingBalance: true},
    }),
  ]);

  const visitsById = new Map(visits.map((visit) => [visit.id, visit]));
  const entriesById = new Map(calendarEntries.map((entry) => [entry.id, entry]));
  const visitsByEntryId = new Map();
  for (const visit of visits) {
    const group = visitsByEntryId.get(visit.calendarEntryId) || [];
    group.push(visit.id);
    visitsByEntryId.set(visit.calendarEntryId, group);
  }

  const duplicateVisitLinks = [...visitsByEntryId.entries()]
    .filter(([, visitIds]) => visitIds.length > 1)
    .map(([calendarEntryId, visitIds]) => ({calendarEntryId, visitIds}));
  const missingCalendarEntries = visits
    .filter((visit) => !entriesById.has(visit.calendarEntryId))
    .map((visit) => ({calendarEntryId: visit.calendarEntryId, visitId: visit.id}));
  const missingVisits = calendarEntries
    .filter((entry) => entry.visitId && !visitsById.has(entry.visitId))
    .map((entry) => ({calendarEntryId: entry.id, visitId: entry.visitId}));
  const completedEntriesWithoutVisit = calendarEntries
    .filter((entry) => entry.status === 'completed' && !entry.visitId)
    .map((entry) => ({calendarEntryId: entry.id}));
  const mismatchedVisitLinks = visits
    .filter((visit) => {
      const entry = entriesById.get(visit.calendarEntryId);
      return entry && entry.visitId !== visit.id;
    })
    .map((visit) => ({
      calendarEntryId: visit.calendarEntryId,
      calendarVisitId: entriesById.get(visit.calendarEntryId)?.visitId || null,
      visitId: visit.id,
    }));
  const invalidPackageBalances = packages
    .filter((item) =>
      Number(item.remainingVisits) < 0 ||
      (item.totalVisits !== null && item.remainingVisits !== null && Number(item.remainingVisits) > Number(item.totalVisits)),
    )
    .map((item) => ({id: item.id, remainingVisits: item.remainingVisits, totalVisits: item.totalVisits}));
  const invalidCertificateBalances = certificates
    .filter((item) =>
      Number(item.remainingBalance) < 0 ||
      (item.nominal !== null && item.remainingBalance !== null && Number(item.remainingBalance) > Number(item.nominal)),
    )
    .map((item) => ({
      id: item.id,
      nominal: item.nominal === null ? null : Number(item.nominal),
      remainingBalance: item.remainingBalance === null ? null : Number(item.remainingBalance),
    }));

  const checks = {
    completedEntriesWithoutVisit: {count: completedEntriesWithoutVisit.length, severity: 'critical', samples: sample(completedEntriesWithoutVisit)},
    duplicateVisitLinks: {count: duplicateVisitLinks.length, severity: 'critical', samples: sample(duplicateVisitLinks)},
    invalidCertificateBalances: {count: invalidCertificateBalances.length, severity: 'warning', samples: sample(invalidCertificateBalances)},
    invalidPackageBalances: {count: invalidPackageBalances.length, severity: 'warning', samples: sample(invalidPackageBalances)},
    mismatchedVisitLinks: {count: mismatchedVisitLinks.length, severity: 'critical', samples: sample(mismatchedVisitLinks)},
    missingCalendarEntries: {count: missingCalendarEntries.length, severity: 'critical', samples: sample(missingCalendarEntries)},
    missingVisits: {count: missingVisits.length, severity: 'critical', samples: sample(missingVisits)},
  };
  const criticalCount = Object.values(checks)
    .filter((check) => check.severity === 'critical')
    .reduce((total, check) => total + check.count, 0);
  const warningCount = Object.values(checks)
    .filter((check) => check.severity === 'warning')
    .reduce((total, check) => total + check.count, 0);

  return {
    checkedAt: new Date().toISOString(),
    checks,
    healthy: criticalCount === 0,
    summary: {criticalCount, warningCount},
  };
}

module.exports = {checkDataIntegrity};
