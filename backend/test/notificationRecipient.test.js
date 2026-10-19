const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  normalizeNotificationEventInput,
  updateNotificationRecipient,
} = require('../services/notificationEventsService');

test('site booking notifications keep a missing client id as null', () => {
  const event = normalizeNotificationEventInput({
    clientId: null,
    entityId: 'booking-42',
    entityType: 'site_booking_request',
    title: 'New site booking',
    type: 'site_booking_request',
  });

  assert.equal(event.clientId, null);
});

test('marking an event seen updates only the authenticated recipient', async () => {
  const recipients = new Map();
  const prisma = {
    notificationEvent: {
      findUnique: async () => ({id: 5, status: 'new', title: 'Event'}),
      update: async () => assert.fail('global notification event must not be updated'),
    },
    notificationRecipient: {
      upsert: async ({create}) => {
        const value = {id: 51, status: 'new', ...create};
        recipients.set(create.userId, value);
        return value;
      },
      update: async ({data, where}) => {
        const current = [...recipients.values()].find((item) => item.id === where.id);
        const value = {...current, ...data};
        recipients.set(value.userId, value);
        return value;
      },
    },
  };

  const result = await updateNotificationRecipient(prisma, 11, 5, {action: 'seen', status: 'seen'});
  assert.equal(result.status, 'seen');
  assert.equal(recipients.get(11).status, 'seen');
  assert.equal(recipients.has(12), false);
});
