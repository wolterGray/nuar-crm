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

const formatDate = (value) => {
  const normalized = cleanString(value);
  if (!normalized) return '';
  const parsed = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Warsaw',
  }).format(parsed);
};
const formatDateTime = (date, time) => [formatDate(date), cleanString(time)].filter(Boolean).join(', ');
const formatPersonServiceDate = ({clientName, date, serviceName, time}) => [
  cleanString(clientName) || 'Клиент',
  cleanString(serviceName) || 'Услуга',
  formatDateTime(date, time),
].filter(Boolean).join(' · ');
const getVisitUrl = (event, payload) => {
  if (payload.deleted === true) return `/calendar?date=${encodeURIComponent(payload.date || '')}`;
  const parameter = event.entityType === 'visit' ? 'visit' : 'entry';
  const date = event.entityType === 'visit' && payload.date ? `&date=${encodeURIComponent(payload.date)}` : '';
  return `/calendar?${parameter}=${encodeURIComponent(event.entityId || '')}${date}`;
};
const formatVisitBody = (payload) => [
  formatPersonServiceDate(payload),
  Number(payload.durationMin || payload.durationMinutes) > 0
    ? `${Number(payload.durationMin || payload.durationMinutes)} мин`
    : '',
].filter(Boolean).join(' · ');

const buildBusinessPushPayload = (event) => {
  const config = EVENT_CONFIG[event?.type];
  if (!config) return null;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

  if (event.type === 'site_booking_request') {
    return {
      body: formatVisitBody({
        clientName: event.clientName || payload.clientName,
        date: payload.preferredDate,
        durationMin: payload.durationMinutes,
        serviceName: payload.serviceName,
        time: payload.preferredTime,
      }) || 'Откройте CRM, чтобы обработать заявку',
      tag: `nuar-${event.fingerprint}`,
      title: config.title,
      ttl: 3600,
      type: event.type,
      url: `/operations?waitlist=${encodeURIComponent(payload.waitlistEntryId || event.entityId || '')}`,
    };
  }

  if (event.type === 'visit_rescheduled') {
    const oldDateTime = formatDateTime(payload.oldDate, payload.oldTime);
    const newDateTime = formatDateTime(payload.newDate, payload.newTime);
    return {
      body: [
        cleanString(payload.clientName) || cleanString(event.clientName) || 'Клиент',
        cleanString(payload.serviceName) || 'Услуга',
        oldDateTime && newDateTime
          ? `${oldDateTime} → ${newDateTime}`
          : `Новое время: ${newDateTime || 'откройте календарь'}`,
      ].filter(Boolean).join(' · '),
      tag: `nuar-${event.fingerprint}`,
      title: config.title,
      ttl: 3600,
      type: event.type,
      url: getVisitUrl(event, payload),
    };
  }
  if (event.type.startsWith('visit_')) {
    return {
      body: formatVisitBody({...payload, clientName: payload.clientName || event.clientName})
        || 'Откройте календарь, чтобы посмотреть запись',
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
    body: [cleanString(payload.taskTitle) || cleanString(event.message), dueLabel ? `Срок: ${dueLabel}` : ''].filter(Boolean).join(' · ')
      || 'Откройте задачу, чтобы посмотреть детали',
    tag: `nuar-${event.fingerprint}`,
    title: config.title,
    ttl: 3600,
    type: event.type,
    url: `/operations?task=${encodeURIComponent(event.entityId || '')}`,
  };
};

const getTargetUsers = async (prisma, event, config) => {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const roleConditions = [
    {role: {in: ['owner', 'admin']}},
  ];

  const targetEmployeeId = Number(payload.employeeId || payload.masterId || payload.preferredMasterId);
  if (Number.isInteger(targetEmployeeId) && targetEmployeeId > 0) {
    roleConditions.push({employeeId: targetEmployeeId});
  }

  const targetUserId = Number(payload.userId || payload.assignedUserId);
  if (Number.isInteger(targetUserId) && targetUserId > 0) {
    roleConditions.push({id: targetUserId});
  }

  const where = {
    isActive: true,
    [config.preference]: true,
    OR: roleConditions,
  };

  return prisma.user.findMany({
    select: {
      id: true,
      role: true,
      employeeId: true,
      [config.preference]: true,
      pushSubscriptions: {select: {id: true}, where: {isActive: true}},
    },
    where,
  });
};

const queueBusinessPushDeliveries = async (prisma, event, options = {}) => {
  const config = EVENT_CONFIG[event?.type];
  const pushPayload = buildBusinessPushPayload(event);
  if (!config || !pushPayload || !isWebPushConfigured()) return {queued: 0, skipped: true};

  const users = await getTargetUsers(prisma, event, config);
  const deliveries = users.flatMap((user) => (user.pushSubscriptions || []).map((subscription) => ({
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
    data: users.map((user) => ({notificationEventId: event.id, userId: user.id})),
    skipDuplicates: true,
  });
  if (deliveries.length === 0) return {queued: 0};
  const result = await prisma.notificationDelivery.createMany({data: deliveries, skipDuplicates: true});

  if (options.flushImmediately === true && typeof prisma?.notificationDelivery?.findMany === 'function') {
    await processDueWebPushDeliveries(prisma, options);
  } else if (options.flushImmediately !== false && typeof prisma?.notificationDelivery?.findMany === 'function') {
    processDueWebPushDeliveries(prisma, options).catch((err) => {
      console.error('[businessPush] Immediate flush error:', err);
    });
  }

  return {queued: result.count};
};

const recordBusinessNotificationEvent = async (prisma, input, upsertNotificationEvent, options = {}) => {
  const event = await upsertNotificationEvent(prisma, input);
  await queueBusinessPushDeliveries(prisma, event, options);
  return event;
};

const processDueWebPushDeliveries = async (prisma, options = {}) => {
  const {limit = 50, sendNotification} = options;
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
    await processQueuedPushDelivery(prisma, delivery, options);
    processed += 1;
  }
  return {processed};
};

module.exports = {
  EVENT_CONFIG,
  buildBusinessPushPayload,
  getTargetUsers,
  processDueWebPushDeliveries,
  queueBusinessPushDeliveries,
  recordBusinessNotificationEvent,
};
