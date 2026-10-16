const assert = require('node:assert/strict');
const {before, test} = require('node:test');
const webpush = require('web-push');
const {sendPushToSubscription} = require('../services/webPushService');

const subscription = {
  auth: 'auth-key',
  endpoint: 'https://push.example.test/subscription',
  id: 17,
  p256dh: 'public-key',
};

const payload = {
  body: 'Проверка доставки',
  title: 'Nuar CRM',
  type: 'test',
  url: '/',
};

const createPrismaMock = () => {
  const calls = {deliveries: [], subscriptions: []};
  return {
    calls,
    notificationDelivery: {
      create: async ({data}) => {
        calls.deliveries.push({operation: 'create', data});
        return {id: 31, ...data};
      },
      update: async ({data, where}) => {
        calls.deliveries.push({operation: 'update', data, where});
        return {id: where.id, ...data};
      },
    },
    pushSubscription: {
      update: async ({data, where}) => {
        calls.subscriptions.push({data, where});
        return {id: where.id, ...data};
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
};

before(() => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
});

test('records a successful Web Push delivery', async () => {
  const prisma = createPrismaMock();
  const result = await sendPushToSubscription(prisma, subscription, payload, {
    sendNotification: async () => ({headers: {location: 'message-1'}}),
    retryDelays: [0, 0],
  });

  assert.equal(result.ok, true);
  assert.equal(prisma.calls.deliveries.at(-1).data.status, 'sent');
  assert.equal(prisma.calls.deliveries.at(-1).data.attempts, 1);
  assert.equal(prisma.calls.subscriptions.at(-1).data.failureCount, 0);
});

test('retries a temporary provider failure and records the actual attempt count', async () => {
  const prisma = createPrismaMock();
  let attempts = 0;
  const result = await sendPushToSubscription(prisma, subscription, payload, {
    sendNotification: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('temporary'), {statusCode: 503});
      return {};
    },
    retryDelays: [0, 0],
  });

  assert.equal(result.ok, true);
  assert.equal(attempts, 2);
  assert.equal(prisma.calls.deliveries.at(-1).data.attempts, 2);
});

test('deactivates an expired subscription without retrying', async () => {
  const prisma = createPrismaMock();
  let attempts = 0;
  const result = await sendPushToSubscription(prisma, subscription, payload, {
    sendNotification: async () => {
      attempts += 1;
      throw Object.assign(new Error('gone'), {statusCode: 410});
    },
    retryDelays: [0, 0],
  });

  assert.equal(result.ok, false);
  assert.equal(result.expired, true);
  assert.equal(attempts, 1);
  assert.equal(prisma.calls.deliveries.at(-1).data.attempts, 1);
  assert.equal(prisma.calls.subscriptions.length, 1);
  assert.equal(prisma.calls.subscriptions[0].data.isActive, false);
  assert.deepEqual(prisma.calls.subscriptions[0].data.failureCount, {increment: 1});
});
