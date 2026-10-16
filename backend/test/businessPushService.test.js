const assert = require('node:assert/strict');
const {test} = require('node:test');
const webpush = require('web-push');
const {
  buildBusinessPushPayload,
  processDueWebPushDeliveries,
  queueBusinessPushDeliveries,
} = require('../services/businessPushService');

test('visit Push payload contains a deep link but no client personal data', () => {
  const payload = buildBusinessPushPayload({
    entityId: '42',
    fingerprint: 'visit:42:created',
    payload: {clientName: 'Sensitive Name', date: '2026-10-16', phone: '+48123456789', time: '14:30'},
    type: 'visit_created',
  });

  assert.equal(payload.url, '/calendar?entry=42');
  assert.match(payload.body, /2026-10-16/);
  assert.doesNotMatch(JSON.stringify(payload), /Sensitive Name|48123456789/);
});

test('queues one idempotent delivery per active owner device', async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  let rows = [];
  const prisma = {
    notificationDelivery: {
      createMany: async ({data}) => {
        rows = data;
        return {count: data.length};
      },
    },
    notificationRecipient: {createMany: async () => ({count: 1})},
    user: {
      findMany: async () => [{id: 1, pushNewVisits: true, pushSubscriptions: [{id: 7}, {id: 8}]}],
    },
  };
  const result = await queueBusinessPushDeliveries(prisma, {
    id: 12,
    entityId: '42',
    fingerprint: 'visit:42:created',
    payload: {date: '2026-10-16', time: '14:30'},
    type: 'visit_created',
  });

  assert.equal(result.queued, 2);
  assert.deepEqual(rows.map((row) => row.deduplicationKey), [
    'web-push:event:12:subscription:7',
    'web-push:event:12:subscription:8',
  ]);
  assert.ok(rows.every((row) => row.notificationEventId === 12));
});

test('does not queue a disabled category or require an active subscription', async () => {
  let recipientRows = [];
  const prisma = {
    notificationDelivery: {createMany: async () => assert.fail('delivery must not be created')},
    notificationRecipient: {createMany: async ({data}) => { recipientRows = data; return {count: data.length}; }},
    user: {findMany: async ({where}) => {
      assert.equal(where.pushVisitCancelled, true);
      return [];
    }},
  };
  const result = await queueBusinessPushDeliveries(prisma, {
    id: 13, entityId: '43', fingerprint: 'visit:43:cancelled', payload: {}, type: 'visit_cancelled',
  });
  assert.equal(result.queued, 0);
  assert.deepEqual(recipientRows, []);
});

test('concurrent workers claim a queued delivery only once', async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  let status = 'pending';
  let sends = 0;
  const delivery = {
    attempts: 0,
    createdAt: new Date(),
    id: 91,
    messageText: JSON.stringify({body: 'Test', title: 'NUAR', url: '/'}),
    pushSubscription: {auth: 'auth', endpoint: 'https://push.test/1', id: 7, isActive: true, p256dh: 'key'},
    status,
  };
  const prisma = {
    notificationDelivery: {
      findMany: async () => [{...delivery, status}],
      updateMany: async () => {
        if (status !== 'pending') return {count: 0};
        status = 'processing';
        return {count: 1};
      },
      update: async ({data}) => { status = data.status; return {...delivery, ...data}; },
    },
    pushSubscription: {update: async ({data}) => data},
    $transaction: async (operations) => Promise.all(operations),
  };
  const sendNotification = async () => { sends += 1; return {}; };
  await Promise.all([
    processDueWebPushDeliveries(prisma, {sendNotification}),
    processDueWebPushDeliveries(prisma, {sendNotification}),
  ]);
  assert.equal(sends, 1);
  assert.equal(status, 'sent');
});
