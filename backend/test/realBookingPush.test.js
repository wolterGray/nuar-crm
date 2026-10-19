const assert = require('node:assert/strict');
const {test} = require('node:test');
const webpush = require('web-push');
const {
  buildBusinessPushPayload,
  getTargetUsers,
  processDueWebPushDeliveries,
  queueBusinessPushDeliveries,
} = require('../services/businessPushService');
const {runWorkerCycle, getWorkerStatus} = require('../services/notificationWorker');

const setupVapid = () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:owner@nuarr.pl';
};

test('E2E Real Booking Push: generates clean payload and delivers successfully', async () => {
  setupVapid();

  const bookingEvent = {
    entityId: 'booking-uuid-101',
    entityType: 'site_booking_request',
    fingerprint: 'site-booking:booking-uuid-101',
    id: 101,
    payload: {
      clientEmail: 'client@example.com',
      clientName: 'Aleksandra Kowalska',
      clientPhone: '+48500100200',
      durationMinutes: 75,
      note: 'Bolą plecy w odcinku lędźwiowym',
      preferredDate: '2026-10-25',
      preferredMaster: 'Olga',
      preferredMasterId: 3,
      preferredTime: '15:00',
      serviceName: 'Masaż Relaksacyjny',
    },
    type: 'site_booking_request',
  };

  // 1. Verify sanitized payload
  const pushPayload = buildBusinessPushPayload(bookingEvent);
  assert.equal(pushPayload.title, 'Новая заявка с сайта');
  assert.equal(pushPayload.url, '/site?booking=booking-uuid-101');
  assert.match(pushPayload.body, /2026-10-25 · 15:00/);
  assert.match(pushPayload.body, /Masaż Relaksacyjny/);
  assert.match(pushPayload.body, /75 мин/);
  // Guarantee no private client contacts leaked in body
  assert.doesNotMatch(pushPayload.body, /Aleksandra|\+48500100200|client@example\.com|plecy/);

  // 2. Mock database state
  const mockUsers = [
    {
      employeeId: null,
      id: 1,
      pushNewVisits: true,
      pushSubscriptions: [{auth: 'auth1', endpoint: 'https://push.apple.com/device1', id: 11, isActive: true, p256dh: 'key1'}],
      role: 'owner',
    },
    {
      employeeId: 3, // Assigned therapist for this booking
      id: 2,
      pushNewVisits: true,
      pushSubscriptions: [{auth: 'auth2', endpoint: 'https://push.apple.com/device2', id: 22, isActive: true, p256dh: 'key2'}],
      role: 'staff',
    },
    {
      employeeId: 99, // Unrelated therapist
      id: 3,
      pushNewVisits: true,
      pushSubscriptions: [{auth: 'auth3', endpoint: 'https://push.apple.com/device3', id: 33, isActive: true, p256dh: 'key3'}],
      role: 'staff',
    },
  ];

  const queuedDeliveries = [];
  const recipientsCreated = [];
  let subscriptionUpdates = [];

  const prisma = {
    $transaction: async (ops) => Promise.all(ops),
    notificationDelivery: {
      createMany: async ({data}) => {
        data.forEach((d) => queuedDeliveries.push({...d, attempts: 0, createdAt: new Date(), id: queuedDeliveries.length + 1}));
        return {count: data.length};
      },
      findMany: async () => queuedDeliveries
        .filter((d) => d.status === 'pending' || d.status === 'retrying')
        .map((d) => {
          const sub = mockUsers.flatMap((u) => u.pushSubscriptions).find((s) => s.id === d.pushSubscriptionId);
          return {...d, pushSubscription: sub};
        }),
      update: async ({data, where}) => {
        const item = queuedDeliveries.find((d) => d.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
      updateMany: async ({data, where}) => {
        const item = queuedDeliveries.find((d) => d.id === where.id);
        if (item) Object.assign(item, data);
        return {count: item ? 1 : 0};
      },
    },
    notificationRecipient: {
      createMany: async ({data}) => {
        recipientsCreated.push(...data);
        return {count: data.length};
      },
    },
    pushSubscription: {
      update: async ({data, where}) => {
        subscriptionUpdates.push({data, id: where.id});
        return {id: where.id, ...data};
      },
    },
    user: {
      findMany: async ({where}) => mockUsers.filter((u) => {
        if (!u.pushNewVisits) return false;
        // Check OR role / employeeId match
        const matchesOr = where.OR.some((cond) => {
          if (cond.role?.in?.includes(u.role)) return true;
          if (cond.employeeId && cond.employeeId === u.employeeId) return true;
          return false;
        });
        return matchesOr;
      }),
    },
  };

  // 3. Queue deliveries with immediate synchronous flush
  const deliveredEndpoints = [];
  const mockSendNotification = async (sub, body) => {
    deliveredEndpoints.push(sub.endpoint);
    return {headers: {location: 'https://push.apple.com/msg-uuid-ok'}};
  };

  const queueResult = await queueBusinessPushDeliveries(prisma, bookingEvent, {
    flushImmediately: true,
    sendNotification: mockSendNotification,
  });

  // Verify owner and assigned therapist were targeted (2 users, 2 subscriptions)
  assert.equal(queueResult.queued, 2);
  assert.equal(deliveredEndpoints.length, 2);
  assert.ok(deliveredEndpoints.includes('https://push.apple.com/device1'));
  assert.ok(deliveredEndpoints.includes('https://push.apple.com/device2'));
  assert.ok(!deliveredEndpoints.includes('https://push.apple.com/device3'));

  // Verify deliveries are marked 'sent'
  assert.equal(queuedDeliveries.length, 2);
  assert.ok(queuedDeliveries.every((d) => d.status === 'sent'));
  assert.ok(queuedDeliveries.every((d) => d.sentAt instanceof Date));
  assert.ok(queuedDeliveries.every((d) => d.providerMessageId === 'https://push.apple.com/msg-uuid-ok'));
});

test('Retry pipeline: temporary 503 marks delivery retrying with backoff', async () => {
  setupVapid();

  const delivery = {
    attempts: 0,
    createdAt: new Date(),
    id: 501,
    messageText: JSON.stringify({body: 'Test', title: 'Test'}),
    pushSubscription: {auth: 'auth', endpoint: 'https://push.google.com/test', id: 88, isActive: true, p256dh: 'p256'},
    scheduledAt: new Date(),
    status: 'pending',
  };

  let updatedDelivery = null;
  const prisma = {
    $transaction: async (ops) => Promise.all(ops),
    notificationDelivery: {
      findMany: async () => [delivery],
      update: async ({data}) => { updatedDelivery = data; return {...delivery, ...data}; },
      updateMany: async () => ({count: 1}),
    },
    pushSubscription: {update: async () => ({})},
  };

  const mockSendError = async () => {
    const error = new Error('Service Unavailable');
    error.statusCode = 503;
    throw error;
  };

  const result = await processDueWebPushDeliveries(prisma, {
    maxAttemptsThisRun: 1,
    retryDelays: [],
    sendNotification: mockSendError,
  });
  assert.equal(result.processed, 1);
  assert.equal(updatedDelivery.status, 'retrying');
  assert.equal(updatedDelivery.attempts, 1);
  assert.match(updatedDelivery.errorMessage, /503/);
  assert.ok(updatedDelivery.scheduledAt > new Date());
});

test('Subscription expiry: 410 Gone deactivates subscription and marks delivery failed', async () => {
  setupVapid();

  const delivery = {
    attempts: 0,
    createdAt: new Date(),
    id: 502,
    messageText: JSON.stringify({body: 'Test', title: 'Test'}),
    pushSubscription: {auth: 'auth', endpoint: 'https://push.apple.com/expired', id: 99, isActive: true, p256dh: 'p256'},
    scheduledAt: new Date(),
    status: 'pending',
  };

  let updatedDelivery = null;
  let updatedSubscription = null;

  const prisma = {
    $transaction: async (ops) => Promise.all(ops),
    notificationDelivery: {
      findMany: async () => [delivery],
      update: async ({data}) => { updatedDelivery = data; return {...delivery, ...data}; },
      updateMany: async () => ({count: 1}),
    },
    pushSubscription: {
      update: async ({data}) => { updatedSubscription = data; return data; },
    },
  };

  const mockSendExpired = async () => {
    const error = new Error('Not Found / Gone');
    error.statusCode = 410;
    throw error;
  };

  await processDueWebPushDeliveries(prisma, {sendNotification: mockSendExpired});
  assert.equal(updatedDelivery.status, 'failed');
  assert.match(updatedDelivery.errorMessage, /expired \(410\)/i);
  assert.equal(updatedSubscription.isActive, false);
});

test('Notification worker: runWorkerCycle coordinates web push and sms queues', async () => {
  setupVapid();

  const prisma = {
    notificationDelivery: {
      findMany: async () => [],
    },
  };

  const status = await runWorkerCycle(prisma);
  assert.equal(status.ok, true);
  assert.ok(status.webPush);
  assert.ok(status.sms);
  assert.ok(status.timestamp);
});
