const assert = require('node:assert/strict');
const {test} = require('node:test');
const {getNotificationCountsForUser} = require('../services/notificationEventsService');

test('personal counts exclude snoozed, resolved and stale events', async () => {
  const now = new Date('2026-10-18T12:00:00');
  const events = [
    {id: 1, entityId: '11', entityType: 'task', payload: {}, status: 'new', type: 'task_due'},
    {id: 2, clientId: 22, entityId: '22', entityType: 'client', payload: {}, status: 'new', type: 'client_inactive'},
    {id: 3, entityId: '33', entityType: 'supply', payload: {}, status: 'new', type: 'supply_low_stock'},
    {id: 4, entityId: '44', entityType: 'calendar_entry', payload: {}, status: 'new', type: 'visit_created'},
  ];
  const prisma = {
    certificate: {findMany: async () => []},
    client: {findMany: async () => [{id: 22, visits: []}]},
    clientPackage: {findMany: async () => []},
    notificationEvent: {findMany: async () => events},
    notificationRecipient: {
      findMany: async () => [{notificationEventId: 4, status: 'resolved', userId: 7}],
    },
    supply: {findMany: async () => [{id: 33, minStock: 5, stock: 8}]},
    task: {
      findMany: async () => [{completed: false, dueDate: new Date('2026-10-17T10:00:00'), id: 11}],
    },
    waitlistEntry: {findMany: async () => []},
  };

  const counts = await getNotificationCountsForUser(prisma, 7, {now});
  assert.deepEqual(counts, {
    action: 1,
    attention: 1,
    critical: 0,
    information: 0,
    opportunity: 1,
    stale: 1,
    total: 2,
  });
});
