const assert = require('node:assert/strict');
const {test} = require('node:test');
const webpush = require('web-push');
const {
  buildBusinessPushPayload,
  processDueWebPushDeliveries,
  queueBusinessPushDeliveries,
} = require('../services/businessPushService');

test('visit Push payload contains an exact deep link and readable visit summary', () => {
  const payload = buildBusinessPushPayload({
    entityId: '42',
    fingerprint: 'visit:42:created',
    payload: {clientName: 'Sensitive Name', date: '2026-10-16', phone: '+48123456789', time: '14:30'},
    type: 'visit_created',
  });

  assert.equal(payload.url, '/calendar?entry=42&date=2026-10-16');
  assert.match(payload.body, /^Sensitive Name · Услуга · 16 октября, 14:30/);
  assert.doesNotMatch(JSON.stringify(payload), /48123456789/);
});

test('visit Push reads client and service labels from nested CRM payloads', () => {
  const payload = buildBusinessPushPayload({
    clientName: 'Fallback Client',
    entityId: '84',
    fingerprint: 'visit:84:created',
    payload: {
      payload: {
        client: 'Maks Kowalski',
        date: '2026-11-06',
        duration: 60,
        service: 'Masaż klasyczny',
        time: '12:30',
      },
    },
    type: 'visit_created',
  });

  assert.equal(
    payload.body,
    'Maks Kowalski · Masaż klasyczny · 6 ноября, 12:30 · 60 мин',
  );
  assert.equal(payload.url, '/calendar?entry=84&date=2026-11-06');
});

test('site booking Push opens the exact queue entry and shows name, service, date and time', () => {
  const payload = buildBusinessPushPayload({
    entityId: 'booking-42',
    fingerprint: 'site-booking:booking-42',
    payload: {
      clientEmail: 'private@example.com',
      clientName: 'Sensitive Name',
      clientPhone: '+48123456789',
      durationMinutes: 60,
      note: 'Private note',
      preferredDate: '2026-10-17',
      preferredTime: '14:30',
      serviceName: 'Massage',
      waitlistEntryId: 77,
    },
    type: 'site_booking_request',
  });

  assert.equal(payload.url, '/operations?waitlist=77');
  assert.match(payload.body, /^Sensitive Name · Massage · 17 октября, 14:30 · 60 мин$/);
  assert.doesNotMatch(JSON.stringify(payload), /48123456789|private@example|Private note/);
});

test('important task Push opens the exact task and uses its title in the body', () => {
  const payload = buildBusinessPushPayload({
    entityId: 'task-15',
    fingerprint: 'task:task-15:important-due',
    message: 'Проверить остатки масла',
    payload: {dueDate: '2026-10-23T10:00:00.000Z', taskTitle: 'Проверить остатки масла'},
    type: 'task_important_due',
  });

  assert.equal(payload.url, '/operations?task=task-15');
  assert.match(payload.body, /^Проверить остатки масла · Срок: 23 октября$/);
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
