const {isWebPushConfigured, processQueuedPushDelivery} = require('./webPushService');

const EVENT_CONFIG = {
  site_booking_request: {preference: 'pushNewVisits', title: 'Новая заявка с сайта'},
  visit_created: {preference: 'pushNewVisits', title: 'Новая запись'},
  visit_cancelled: {preference: 'pushVisitCancelled', title: 'Запись отменена'},
  visit_rescheduled: {preference: 'pushVisitRescheduled', title: 'Запись перенесена'},
  task_important_due: {preference: 'pushImportantTasks', title: 'Важная задача на сегодня'},
  task_important_overdue: {preference: 'pushOverdueTasks', title: 'Важная задача просрочена'},
};

const cleanString = (value) => String(value ?? '').trim();

const formatDateTime = (date, time) => [cleanString(date), cleanString(time)].filter(Boolean).join(' · ');
const getVisitUrl = (event, payload) => {
  if (payload.deleted === true) return `/calendar?date=${encodeURIComponent(payload.date || '')}`;
  const parameter = event.entityType === 'visit' ? 'visit' : 'entry';
  const date = event.entityType === 'visit' && payload.date ? `&date=${encodeURIComponent(payload.date)}` : '';
  return `/calendar?${parameter}=${encodeURIComponent(event.entityId || '')}${date}`;
};
const formatVisitBody = (payload) => [
  formatDateTime(payload.date, payload.time),
  cleanString(payload.serviceName),
  Number(payload.durationMin) > 0 ? `${Number(payload.durationMin)} мин` : '',
].filter(Boolean).join(' · ');

const buildBusinessPushPayload = (event) => {
  const config = EVENT_CONFIG[event?.type];
  if (!config) return null;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

  if (event.type === 'site_booking_request') {
    return {
      body: formatVisitBody({
        date: payload.preferredDate,
        durationMin: payload.durationMinutes,
        serviceName: payload.serviceName,
        time: payload.preferredTime,
      }) || 'Откройте CRM, чтобы обработать заявку',
      tag: `nuar-${event.fingerprint}`,
      title: config.title,
      ttl: 3600,
      type: event.type,
      url: `/site?booking=${encodeURIComponent(event.entityId || '')}`,
    };
  }

  if (event.type === 'visit_rescheduled') {
    const oldDateTime = formatDateTime(payload.oldDate, payload.oldTime);
    const newDateTime = formatDateTime(payload.newDate, payload.newTime);
    return {
      body: [oldDateTime && newDateTime ? `${oldDateTime} → ${newDateTime}` : `Новое время: ${newDateTime || 'откройте календарь'}`, cleanString(payload.serviceName)].filter(Boolean).join(' · '),
      tag: `nuar-${event.fingerprint}`,
      title: config.title,
      ttl: 3600,
      type: event.type,
      url: getVisitUrl(event, payload),
    };
  }
  if (event.type.startsWith('visit_')) {
    return {
      body: formatVisitBody(payload) || 'Откройте календарь, чтобы посмотреть запись',
      tag: `nuar-${event.fingerprint}`,
      title: config.title,
      ttl: 3600,
      type: event.type,
      url: getVisitUrl(event, payload),
    };
  }
  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  const dueLabel = dueDate && !Number.isNaN(dueDate.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw'}).format(dueDate)
    : '';
  return {
    body: dueLabel ? `Срок: ${dueLabel}. Откройте задачу, чтобы посмотреть детали` : 'Откройте задачу, чтобы посмотреть детали',
    tag: `nuar-${event.fingerprint}`,
    title: config.title,
    ttl: 3600,
    type: event.type,
    url: `/operations?task=${encodeURIComponent(event.entityId || '')}`,
  };
};

const queueBusinessPushDeliveries = async (prisma, event) => {
  const config = EVENT_CONFIG[event?.type];
  const pushPayload = buildBusinessPushPayload(event);
  if (!config || !pushPayload || !isWebPushConfigured()) return {queued: 0, skipped: true};

  const owners = await prisma.user.findMany({
    select: {
      id: true,
      [config.preference]: true,
      pushSubscriptions: {select: {id: true}, where: {isActive: true}},
    },
    where: {isActive: true, role: 'owner', [config.preference]: true},
  });
  const deliveries = owners.flatMap((owner) => owner.pushSubscriptions.map((subscription) => ({
    channel: 'web_push',
    deduplicationKey: `web-push:event:${event.id}:subscription:${subscription.id}`,
    messageText: JSON.stringify(pushPayload),
    notificationEventId: event.id,
    pushSubscriptionId: subscription.id,
    recipient: `push-subscription:${subscription.id}`,
    scheduledAt: new Date(),
    status: 'pending',
    templateKey: event.type,
  })));
  await prisma.notificationRecipient.createMany({
    data: owners.map((owner) => ({notificationEventId: event.id, userId: owner.id})),
    skipDuplicates: true,
  });
  if (deliveries.length === 0) return {queued: 0};
  const result = await prisma.notificationDelivery.createMany({data: deliveries, skipDuplicates: true});
  return {queued: result.count};
};

const recordBusinessNotificationEvent = async (prisma, input, upsertNotificationEvent) => {
  const event = await upsertNotificationEvent(prisma, input);
  await queueBusinessPushDeliveries(prisma, event);
  return event;
};

const processDueWebPushDeliveries = async (prisma, {limit = 50, sendNotification} = {}) => {
  if (!isWebPushConfigured()) return {processed: 0, skipped: true, skippedReason: 'not_configured'};
  const staleClaim = new Date(Date.now() - 5 * 60 * 1000);
  const deliveries = await prisma.notificationDelivery.findMany({
    include: {pushSubscription: true},
    orderBy: {createdAt: 'asc'},
    take: Math.max(1, Math.min(200, Number(limit) || 50)),
    where: {
      channel: 'web_push',
      scheduledAt: {lte: new Date()},
      OR: [
        {status: {in: ['pending', 'retrying']}},
        {status: 'processing', updatedAt: {lte: staleClaim}},
      ],
    },
  });
  let processed = 0;
  for (const delivery of deliveries) {
    const claim = await prisma.notificationDelivery.updateMany({
      data: {status: 'processing'},
      where: {
        id: delivery.id,
        OR: [
          {status: {in: ['pending', 'retrying']}},
          {status: 'processing', updatedAt: {lte: staleClaim}},
        ],
      },
    });
    if (claim.count !== 1) continue;
    if (!delivery.pushSubscription?.isActive) {
      await prisma.notificationDelivery.update({data: {status: 'failed', errorMessage: 'Push subscription inactive'}, where: {id: delivery.id}});
      continue;
    }
    await processQueuedPushDelivery(prisma, delivery, {sendNotification});
    processed += 1;
  }
  return {processed};
};

module.exports = {
  EVENT_CONFIG,
  buildBusinessPushPayload,
  processDueWebPushDeliveries,
  queueBusinessPushDeliveries,
  recordBusinessNotificationEvent,
};
