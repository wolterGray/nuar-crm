const MAX_SAMPLES = 20;

const sample = (items) => items.slice(0, MAX_SAMPLES);

const findSiteBookingLifecycleMismatches = (rows = []) => rows.flatMap((row) => {
  const requestStatus = String(row.requestStatus ?? row.request_status ?? '');
  const waitlistStatus = String(row.waitlistStatus ?? row.waitlist_status ?? '');
  const eventStatus = String(row.eventStatus ?? row.event_status ?? '');
  const requestId = String(row.requestId ?? row.request_id ?? '');
  const terminalRequest = ['applied', 'rejected'].includes(requestStatus);
  const terminalWaitlist = ['closed', 'deleted'].includes(waitlistStatus);
  const activeEvent = ['new', 'seen', 'snoozed'].includes(eventStatus);
  const reasons = [];

  if (!row.waitlistId && !row.waitlist_id) reasons.push('missing_waitlist');
  if (!row.eventId && !row.event_id) reasons.push('missing_notification');
  if (requestStatus === 'pending' && terminalWaitlist) reasons.push('pending_request_with_closed_waitlist');
  if (requestStatus === 'pending' && eventStatus === 'resolved') reasons.push('pending_request_with_resolved_notification');
  if (terminalRequest && waitlistStatus && !terminalWaitlist) reasons.push('terminal_request_with_active_waitlist');
  if (terminalRequest && activeEvent) reasons.push('terminal_request_with_active_notification');

  return reasons.length ? [{eventStatus: eventStatus || null, reasons, requestId, requestStatus, waitlistStatus: waitlistStatus || null}] : [];
});

const readSiteBookingLifecycleRows = async (prisma) => {
  if (typeof prisma?.$queryRaw !== 'function') return [];
  try {
    return await prisma.$queryRaw`
      select request.id as "requestId", request.status as "requestStatus",
             waitlist.id as "waitlistId", waitlist.status as "waitlistStatus",
             event.id as "eventId", event.status as "eventStatus"
      from site_booking_requests request
      left join "WaitlistEntry" waitlist
        on waitlist.payload->>'siteBookingRequestId' = request.id
      left join "NotificationEvent" event
        on event.fingerprint = concat('site-booking:', request.id)
      where request.created_at >= now() - interval '180 days'
    `;
  } catch (error) {
    if (error?.meta?.code === '42P01' || /site_booking_requests.*does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
};

async function checkDataIntegrity(prisma) {
  const [visits, calendarEntries, packages, certificates, siteBookingRows] = await Promise.all([
    prisma.visit.findMany({select: {calendarEntryId: true, id: true}}),
    prisma.calendarEntry.findMany({
      select: {id: true, status: true, visitId: true},
    }),
    prisma.clientPackage.findMany({
      select: {id: true, remainingVisits: true, totalVisits: true},
    }),
    prisma.certificate.findMany({
      select: {id: true, nominal: true, remainingBalance: true},
    }),
    readSiteBookingLifecycleRows(prisma),
  ]);

  const visitsById = new Map(visits.map((visit) => [visit.id, visit]));
  const linkedVisits = visits.filter((visit) => visit.calendarEntryId !== null);
  const entriesById = new Map(calendarEntries.map((entry) => [entry.id, entry]));
  const visitsByEntryId = new Map();
  for (const visit of linkedVisits) {
    const group = visitsByEntryId.get(visit.calendarEntryId) || [];
    group.push(visit.id);
    visitsByEntryId.set(visit.calendarEntryId, group);
  }

  const duplicateVisitLinks = [...visitsByEntryId.entries()]
    .filter(([, visitIds]) => visitIds.length > 1)
    .map(([calendarEntryId, visitIds]) => ({calendarEntryId, visitIds}));
  const missingCalendarEntries = linkedVisits
    .filter((visit) => !entriesById.has(visit.calendarEntryId))
    .map((visit) => ({calendarEntryId: visit.calendarEntryId, visitId: visit.id}));
  const missingVisits = calendarEntries
    .filter((entry) => entry.visitId && !visitsById.has(entry.visitId))
    .map((entry) => ({calendarEntryId: entry.id, visitId: entry.visitId}));
  const completedEntriesWithoutVisit = calendarEntries
    .filter((entry) => entry.status === 'completed' && !entry.visitId)
    .map((entry) => ({calendarEntryId: entry.id}));
  const mismatchedVisitLinks = linkedVisits
    .filter((visit) => {
      const entry = entriesById.get(visit.calendarEntryId);
      return entry && entry.visitId !== visit.id;
    })
    .map((visit) => ({
      calendarEntryId: visit.calendarEntryId,
      calendarVisitId: entriesById.get(visit.calendarEntryId)?.visitId || null,
      direction: 'visit_to_calendar',
      visitId: visit.id,
    }))
    .concat(calendarEntries
      .filter((entry) => {
        const visit = entry.visitId ? visitsById.get(entry.visitId) : null;
        return visit && visit.calendarEntryId !== entry.id;
      })
      .map((entry) => ({
        calendarEntryId: entry.id,
        direction: 'calendar_to_visit',
        visitCalendarEntryId: visitsById.get(entry.visitId)?.calendarEntryId || null,
        visitId: entry.visitId,
      })));
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
  const siteBookingLifecycleMismatches = findSiteBookingLifecycleMismatches(siteBookingRows);

  const checks = {
    completedEntriesWithoutVisit: {count: completedEntriesWithoutVisit.length, severity: 'critical', samples: sample(completedEntriesWithoutVisit)},
    duplicateVisitLinks: {count: duplicateVisitLinks.length, severity: 'critical', samples: sample(duplicateVisitLinks)},
    invalidCertificateBalances: {count: invalidCertificateBalances.length, severity: 'warning', samples: sample(invalidCertificateBalances)},
    invalidPackageBalances: {count: invalidPackageBalances.length, severity: 'warning', samples: sample(invalidPackageBalances)},
    mismatchedVisitLinks: {count: mismatchedVisitLinks.length, severity: 'critical', samples: sample(mismatchedVisitLinks)},
    missingCalendarEntries: {count: missingCalendarEntries.length, severity: 'critical', samples: sample(missingCalendarEntries)},
    missingVisits: {count: missingVisits.length, severity: 'critical', samples: sample(missingVisits)},
    siteBookingLifecycleMismatches: {count: siteBookingLifecycleMismatches.length, severity: 'warning', samples: sample(siteBookingLifecycleMismatches)},
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

module.exports = {checkDataIntegrity, findSiteBookingLifecycleMismatches};
