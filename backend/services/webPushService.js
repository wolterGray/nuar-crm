const webpush = require('web-push');

const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const cleanString = (value) => String(value ?? '').trim();

const getVapidConfiguration = () => ({
  privateKey: cleanString(process.env.VAPID_PRIVATE_KEY),
  publicKey: cleanString(process.env.VAPID_PUBLIC_KEY),
  subject: cleanString(process.env.VAPID_SUBJECT) || 'mailto:admin@nuarr.pl',
});

const isWebPushConfigured = () => {
  const config = getVapidConfiguration();
  return Boolean(config.privateKey && config.publicKey && config.subject);
};

const configureWebPush = () => {
  const config = getVapidConfiguration();
  if (!config.privateKey || !config.publicKey) {
    const error = new Error('Web Push is not configured');
    error.status = 503;
    throw error;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
};

const getPushStatusCode = (error) => Number(error?.statusCode || error?.status || 0);

const isExpiredPushSubscriptionError = (error) =>
  [404, 410].includes(getPushStatusCode(error));

const isRetryablePushError = (error) =>
  RETRYABLE_STATUS_CODES.has(getPushStatusCode(error));

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const serializeSubscription = (subscription) => ({
  endpoint: subscription.endpoint,
  expirationTime: null,
  keys: {
    auth: subscription.auth,
    p256dh: subscription.p256dh,
  },
});

const createDelivery = (prisma, subscription, payload) =>
  prisma.notificationDelivery.create({
    data: {
      channel: 'web_push',
      messageText: JSON.stringify({title: payload.title, body: payload.body, url: payload.url}),
      pushSubscriptionId: subscription.id,
      recipient: `push-subscription:${subscription.id}`,
      scheduledAt: new Date(),
      status: 'pending',
      templateKey: payload.type || 'web-push',
    },
  });

const deliverPush = async (
  prisma,
  delivery,
  subscription,
  payload,
  {sendNotification = webpush.sendNotification, retryDelays = [250, 750]} = {},
) => {
  configureWebPush();
  let lastError = null;
  let attempts = Number(delivery.attempts) || 0;

  for (let attempt = attempts + 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    try {
      const result = await sendNotification(
        serializeSubscription(subscription),
        JSON.stringify(payload),
        {TTL: Math.max(60, Number(payload.ttl) || 300)},
      );
      const now = new Date();
      await prisma.$transaction([
        prisma.notificationDelivery.update({
          data: {attempts, errorMessage: null, providerMessageId: result?.headers?.location || null, sentAt: now, status: 'sent'},
          where: {id: delivery.id},
        }),
        prisma.pushSubscription.update({
          data: {failureCount: 0, lastError: null, lastErrorAt: null, lastUsedAt: now},
          where: {id: subscription.id},
        }),
      ]);
      return {ok: true, deliveryId: delivery.id, subscriptionId: subscription.id};
    } catch (error) {
      lastError = error;
      if (isExpiredPushSubscriptionError(error)) break;
      if (!isRetryablePushError(error) || attempt === MAX_ATTEMPTS) break;
      await sleep(retryDelays[attempt - 1] ?? 1000);
    }
  }

  const statusCode = getPushStatusCode(lastError);
  const expired = isExpiredPushSubscriptionError(lastError);
  const retryable = isRetryablePushError(lastError) && attempts < MAX_ATTEMPTS;
  const safeError = expired ? `Push endpoint expired (${statusCode})` : statusCode ? `Web Push failed (${statusCode})` : 'Web Push failed';
  await prisma.$transaction([
    prisma.notificationDelivery.update({
      data: {attempts, errorMessage: safeError, status: retryable ? 'retrying' : 'failed'},
      where: {id: delivery.id},
    }),
    prisma.pushSubscription.update({
      data: {failureCount: {increment: 1}, ...(expired ? {isActive: false} : {}), lastError: safeError, lastErrorAt: new Date()},
      where: {id: subscription.id},
    }),
  ]);
  return {expired, ok: false, statusCode, subscriptionId: subscription.id};
};

const sendPushToSubscription = async (
  prisma,
  subscription,
  payload,
  {sendNotification = webpush.sendNotification, retryDelays = [250, 750]} = {},
) => {
  const delivery = await createDelivery(prisma, subscription, payload);
  return deliverPush(prisma, delivery, subscription, payload, {sendNotification, retryDelays});
};

const processQueuedPushDelivery = async (prisma, delivery, options = {}) => {
  let payload;
  try {
    payload = JSON.parse(delivery.messageText);
  } catch {
    await prisma.notificationDelivery.update({data: {errorMessage: 'Invalid Web Push payload', status: 'failed'}, where: {id: delivery.id}});
    return {ok: false, deliveryId: delivery.id};
  }
  return deliverPush(prisma, delivery, delivery.pushSubscription, payload, options);
};

const sendPushToUser = async (prisma, userId, payload, options) => {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {isActive: true, userId},
  });
  const results = [];
  for (const subscription of subscriptions) {
    results.push(await sendPushToSubscription(prisma, subscription, payload, options));
  }
  return {
    failed: results.filter((result) => !result.ok).length,
    sent: results.filter((result) => result.ok).length,
    total: results.length,
  };
};

module.exports = {
  getVapidConfiguration,
  isExpiredPushSubscriptionError,
  isRetryablePushError,
  isWebPushConfigured,
  processQueuedPushDelivery,
  sendPushToSubscription,
  sendPushToUser,
};
