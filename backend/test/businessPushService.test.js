const assert = require('node:assert/strict');
const {test} = require('node:test');
const webpush = require('web-push');
const {
  buildBusinessPushPayload,
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
