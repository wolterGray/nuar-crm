const assert = require('node:assert/strict');
const {test} = require('node:test');
const {getNotificationCountsForUser} = require('../services/notificationEventsService');

test('personal counts exclude snoozed, resolved and stale events', async () => {
  const now = new Date('2026-10-18T12:00:00');
  const events = [
    {id: 1, entityId: '11', entityType: 'waitlist_entry', payload: {}, status: 'new', type: 'waitlist_entry'},
    {id: 2, entityId: '22', entityType: 'site_booking_request', payload: {}, status: 'new', type: 'site_booking_request'},
    {id: 3, entityId: '33', entityType: 'supply', payload: {}, status: 'new', type: 'supply_low_stock'},
    {id: 4, entityId: '44', entityType: 'calendar_entry', payload: {}, status: 'new', type: 'visit_created'},
  ];
  const prisma = {
    notificationEvent: {
      findMany: async () => events,
      updateMany: async () => ({count: 0}),
    },
    notificationRecipient: {
      findMany: async () => [{notificationEventId: 4, status: 'resolved', userId: 7}],
      updateMany: async () => ({count: 0}),
    },
    supply: {findMany: async () => [{id: 33, minStock: 5, stock: 8}]},
    user: {findUnique: async () => ({id: 7, role: 'owner'})},
    waitlistEntry: {findMany: async () => [{id: 11, status: 'active'}]},
  };

  const counts = await getNotificationCountsForUser(prisma, 7, {now});
  assert.deepEqual(counts, {
    action: 2,
    attention: 2,
    critical: 0,
    information: 0,
    stale: 1,
    total: 2,
  });
});
