const syncSiteBookingFromWaitlistStatus = async (tx, requestId, {deleted, now = new Date()} = {}) => {
  const id = String(requestId ?? '').trim();
  if (!id) return;

  const requestStatus = deleted ? 'rejected' : 'pending';
  await tx.$executeRaw`
    update site_booking_requests
    set status = ${requestStatus}, updated_at = now()
    where id = ${id}
  `;

  const events = await tx.notificationEvent.findMany({
    select: {id: true},
    where: {fingerprint: `site-booking:${id}`},
  });
  const eventIds = events.map((event) => event.id);
  if (!eventIds.length) return;

  const action = deleted ? 'waitlist_deleted' : 'waitlist_restored';
  const eventState = deleted
    ? {actionHistory: [{action, at: now.toISOString()}], resolvedAt: now, status: 'resolved'}
    : {actionHistory: [{action, at: now.toISOString()}], resolvedAt: null, status: 'new'};

  await tx.notificationEvent.updateMany({
    data: eventState,
    where: {id: {in: eventIds}},
  });
  await tx.notificationRecipient.updateMany({
    data: eventState,
    where: {notificationEventId: {in: eventIds}},
  });
};

module.exports = {syncSiteBookingFromWaitlistStatus};
