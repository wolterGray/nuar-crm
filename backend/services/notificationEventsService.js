const {recordBusinessNotificationEvent} = require('./businessPushService');
const {
  ACTIVE_EVENT_STATUSES,
  CATEGORY,
  getNotificationCategory,
  isEventCurrent,
  isRecipientVisible,
} = require('./notificationTypeRegistry');

const PRIORITY_SCORE = {
  critical: 100,
  high: 75,
  normal: 45,
  low: 20,
};

const ACTIVE_STATUSES = ACTIVE_EVENT_STATUSES;
const UPCOMING_VISIT_GRACE_MINUTES = 30;

const cleanString = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePriority = (value) => {
  const priority = cleanString(value) || 'normal';
  return PRIORITY_SCORE[priority] ? priority : 'normal';
};

const isImportantTask = (task = {}) => {
  const priority = String(task.priority ?? task.payload?.priority ?? '').trim().toLowerCase();
  return ['critical', 'high', 'urgent', 'срочно', 'высокий'].includes(priority) || task.payload?.isMain === true;
};

const isInactiveTask = (task = {}) => {
  const status = String(task.status ?? task.payload?.status ?? '').trim().toLowerCase();
  return ['archive', 'archived', 'cancelled', 'canceled', 'completed', 'done', 'архив', 'отменена', 'выполнена'].includes(status)
    || task.payload?.templateArchived === true;
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toIsoDate = (date = new Date()) => {
  if (!date) return '';
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return [
    String(value.getFullYear()).padStart(4, '0'),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
};

const parseCrmDate = (value) => {
  const text = cleanString(value);
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  }

  const european = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (european) {
    return new Date(`${european[3]}-${european[2]}-${european[1]}T00:00:00`);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysUntil = (value, now = new Date()) => {
  const date = parseCrmDate(value);
  if (!date) return null;
  const today = new Date(toIsoDate(now));
  return Math.floor((date.getTime() - today.getTime()) / 86400000);
};

const getMinutesFromTime = (value) => {
  const [hours, minutes] = String(value ?? '').split(':').map(Number);
  if (!Number.isFinite(hours)) return null;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const getVisitEventDate = (event = {}, calendarEntry = null) => {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  return toIsoDate(parseCrmDate(calendarEntry?.date ?? payload.date));
};

const getVisitEventTime = (event = {}, calendarEntry = null) => {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  return cleanString(calendarEntry?.time ?? payload.time);
};

const isStaleVisitUpcomingEvent = (event = {}, calendarEntry = null, now = new Date()) => {
  if (event.type !== 'visit_upcoming') return false;

  const today = toIsoDate(now);
  const tomorrow = toIsoDate(new Date(now.getTime() + 86400000));
  const eventDate = getVisitEventDate(event, calendarEntry);
  if (!eventDate) return false;
  if (eventDate < today || eventDate > tomorrow) return true;

  const calendarStatus = cleanString(calendarEntry?.status);
  if (['cancelled', 'canceled', 'completed', 'no_show'].includes(calendarStatus)) return true;

  if (eventDate === today) {
    const eventMinutes = getMinutesFromTime(getVisitEventTime(event, calendarEntry));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (eventMinutes !== null && eventMinutes + UPCOMING_VISIT_GRACE_MINUTES < nowMinutes) {
      return true;
    }
  }

  return false;
};

const isActionableVisitUpcomingEvent = (
  event = {},
  calendarEntry = null,
  now = new Date(),
  horizonMinutes = 180,
) => {
  if (event.type !== 'visit_upcoming') return true;
  if (isStaleVisitUpcomingEvent(event, calendarEntry, now)) return false;

  const today = toIsoDate(now);
  const eventDate = getVisitEventDate(event, calendarEntry);
  if (eventDate !== today) return false;

  const eventMinutes = getMinutesFromTime(getVisitEventTime(event, calendarEntry));
  if (eventMinutes === null) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const difference = eventMinutes - nowMinutes;
  return difference >= 0 && difference <= Math.max(15, Number(horizonMinutes) || 180);
};

const resolveStaleVisitUpcomingEvents = async (prisma, {now = new Date()} = {}) => {
  const activeEvents = await prisma.notificationEvent.findMany({
    where: {
      status: {in: ACTIVE_STATUSES},
      type: 'visit_upcoming',
    },
  });

  if (activeEvents.length === 0) {
    return 0;
  }

  const calendarEntryIds = activeEvents
    .map((event) => Number(event.entityId))
    .filter((id) => Number.isInteger(id) && id > 0);
  const calendarEntries = calendarEntryIds.length > 0
    ? await prisma.calendarEntry.findMany({
        where: {id: {in: [...new Set(calendarEntryIds)]}},
      })
    : [];
  const calendarById = new Map(calendarEntries.map((entry) => [Number(entry.id), entry]));
  const staleIds = activeEvents
    .filter((event) => isStaleVisitUpcomingEvent(event, calendarById.get(Number(event.entityId)), now))
    .map((event) => event.id);

  if (staleIds.length === 0) {
    return 0;
  }

  const result = await prisma.notificationEvent.updateMany({
    data: {
      actionHistory: [{action: 'auto_resolve_stale_visit', at: now.toISOString()}],
      resolvedAt: now,
      status: 'resolved',
    },
    where: {id: {in: staleIds}},
  });

  return result.count;
};

const buildFingerprint = (event) => {
  const parts = [
    cleanString(event.source) || 'crm',
    cleanString(event.type) || 'generic',
    cleanString(event.entityType) || 'none',
    cleanString(event.entityId) || cleanString(event.clientId) || cleanString(event.clientName) || 'global',
  ];

  return parts.join(':');
};

const scoreNotificationEvent = (event = {}) => {
  const priority = normalizePriority(event.priority);
  const base = PRIORITY_SCORE[priority] || PRIORITY_SCORE.normal;
  const moneyImpact = Number(event.moneyImpact ?? event.payload?.moneyImpact ?? 0);
  const clientValue = Number(event.clientValue ?? event.payload?.clientValue ?? 0);
  const urgency = Number(event.urgency ?? event.payload?.urgency ?? 0);

  return Math.max(
    0,
    Math.min(100, Math.round(base + Math.min(20, moneyImpact / 50) + Math.min(15, clientValue / 100) + Math.min(20, urgency))),
  );
};

const normalizeNotificationEventInput = (input = {}) => {
  const priority = normalizePriority(input.priority);
  const source = cleanString(input.source) || 'crm';
  const type = cleanString(input.type) || 'generic';
  const fingerprint = cleanString(input.fingerprint) || buildFingerprint({...input, source, type});
  const title = cleanString(input.title) || 'Уведомление';
  const message = cleanString(input.message) || title;

  return {
    clientId: Number.isInteger(Number(input.clientId)) ? Number(input.clientId) : null,
    clientName: cleanString(input.clientName),
    entityId: cleanString(input.entityId),
    entityType: cleanString(input.entityType),
    fingerprint,
    message,
    payload: input.payload && typeof input.payload === 'object' ? input.payload : null,
    priority,
    recommendedAction: cleanString(input.recommendedAction),
    score: Number.isFinite(Number(input.score)) ? Number(input.score) : scoreNotificationEvent({...input, priority}),
    source,
    status: cleanString(input.status) || 'new',
    title,
    type,
  };
};

const listNotificationEvents = async (prisma, {limit = 50, now = new Date(), status = 'active'} = {}) => {
  const take = Math.max(1, Math.min(500, Number(limit) || 50));
  const internalTake = Math.min(500, Math.max(take * 3, take));
  if (status === 'active') {
    await resolveStaleVisitUpcomingEvents(prisma, {now});
  }
  const where =
    status === 'all'
      ? {}
      : status === 'active'
        ? {
            status: {in: ACTIVE_STATUSES},
            OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
          }
        : {status};

  const events = await prisma.notificationEvent.findMany({
    orderBy: [{score: 'desc'}, {createdAt: 'desc'}],
    take: internalTake,
    where,
  });

  return events
    .filter((event) => !isStaleVisitUpcomingEvent(event, null, now))
    .filter((event) => isActionableVisitUpcomingEvent(event, null, now))
    .slice(0, take);
};

const upsertNotificationEvent = async (prisma, input) => {
  const data = normalizeNotificationEventInput(input);
  const current = input.reopenWhenCurrent
    ? await prisma.notificationEvent.findUnique({where: {fingerprint: data.fingerprint}})
    : null;

  return prisma.notificationEvent.upsert({
    create: data,
    update: {
      clientName: data.clientName,
      entityId: data.entityId,
      entityType: data.entityType,
      message: data.message,
      payload: data.payload,
      priority: data.priority,
      recommendedAction: data.recommendedAction,
      score: data.score,
      source: data.source,
      ...(current && ['resolved', 'dismissed'].includes(current.status)
        ? {resolvedAt: null, status: 'new'}
        : {}),
      title: data.title,
      type: data.type,
    },
    where: {fingerprint: data.fingerprint},
  });
};

const getEntityIds = (events, entityType) => [...new Set(events
  .filter((event) => event.entityType === entityType)
  .map((event) => Number(event.entityId))
  .filter((id) => Number.isInteger(id) && id > 0))];

const loadNotificationLinkedState = async (prisma, events) => {
  const taskIds = getEntityIds(events, 'task');
  const supplyIds = getEntityIds(events, 'supply');
  const packageIds = getEntityIds(events, 'client_package');
  const certificateIds = getEntityIds(events, 'certificate');
  const waitlistIds = getEntityIds(events, 'waitlist_entry');
  const clientIds = [...new Set(events
    .filter((event) => event.type === 'client_inactive')
    .map((event) => Number(event.clientId ?? event.entityId))
    .filter((id) => Number.isInteger(id) && id > 0))];

  const [tasks, supplies, packages, certificates, waitlistEntries, clients] = await Promise.all([
    taskIds.length ? prisma.task.findMany({where: {id: {in: taskIds}}}) : [],
    supplyIds.length ? prisma.supply.findMany({where: {id: {in: supplyIds}}}) : [],
    packageIds.length ? prisma.clientPackage.findMany({where: {id: {in: packageIds}}}) : [],
    certificateIds.length ? prisma.certificate.findMany({where: {id: {in: certificateIds}}}) : [],
    waitlistIds.length ? prisma.waitlistEntry.findMany({where: {id: {in: waitlistIds}}}) : [],
    clientIds.length
      ? prisma.client.findMany({
          include: {
            visits: {orderBy: {scheduledAt: 'desc'}, select: {scheduledAt: true}, take: 1},
          },
          where: {id: {in: clientIds}},
        })
      : [],
  ]);

  return {
    certificates: new Map(certificates.map((item) => [Number(item.id), item])),
    clients: new Map(clients.map((item) => [Number(item.id), item])),
    packages: new Map(packages.map((item) => [Number(item.id), item])),
    supplies: new Map(supplies.map((item) => [Number(item.id), item])),
    tasks: new Map(tasks.map((item) => [Number(item.id), item])),
    waitlistEntries: new Map(waitlistEntries.map((item) => [Number(item.id), item])),
  };
};

const getLinkedStateForEvent = (event, state) => ({
  certificate: state.certificates.get(Number(event.entityId)),
  client: state.clients.get(Number(event.clientId ?? event.entityId)),
  clientPackage: state.packages.get(Number(event.entityId)),
  supply: state.supplies.get(Number(event.entityId)),
  task: state.tasks.get(Number(event.entityId)),
  waitlistEntry: state.waitlistEntries.get(Number(event.entityId)),
});

const classifyNotificationEvents = async (prisma, events, {now = new Date()} = {}) => {
  if (!events.length) return [];
  const state = await loadNotificationLinkedState(prisma, events);
  return events.map((event) => ({
    ...event,
    category: getNotificationCategory(event),
    isCurrent: isEventCurrent(event, getLinkedStateForEvent(event, state), now),
  }));
};

const reconcileNotificationEventLifecycle = async (
  prisma,
  {commit = false, now = new Date()} = {},
) => {
  const events = await prisma.notificationEvent.findMany({
    where: {status: {in: ACTIVE_STATUSES}},
  });
  const classified = await classifyNotificationEvents(prisma, events, {now});
  const stale = classified.filter(
    (event) => event.category !== CATEGORY.INFORMATION && !event.isCurrent,
  );
  const byType = stale.reduce((counts, event) => {
    counts[event.type] = (counts[event.type] || 0) + 1;
    return counts;
  }, {});

  if (commit && stale.length > 0) {
    if (process.env.NOTIFICATION_LIFECYCLE_V2_WRITE !== 'true') {
      const error = new Error('Lifecycle writes require NOTIFICATION_LIFECYCLE_V2_WRITE=true');
      error.status = 409;
      throw error;
    }
    await prisma.$transaction(stale.map((event) => prisma.notificationEvent.update({
      data: {
        actionHistory: appendActionHistory(event.actionHistory, {
          action: 'auto_resolve_stale_condition',
          meta: {category: event.category, type: event.type},
        }),
        resolvedAt: now,
        status: 'resolved',
      },
      where: {id: event.id},
    })));
  }

  return {byType, commit, count: stale.length};
};

const generateSmartNotificationEvents = async (prisma, {now = new Date()} = {}) => {
  await resolveStaleVisitUpcomingEvents(prisma, {now});

  const settings = await prisma.systemState
    .findUnique({where: {key: 'appSettings'}})
    .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
    .catch(() => ({}));

  const today = toIsoDate(now);
  const tomorrow = toIsoDate(new Date(now.getTime() + 86400000));
  const upcomingVisitMinutes = Math.max(15, Number(settings.upcomingVisitMinutes) || 180);
  const generated = [];

  const tasks = await prisma.task.findMany({
    orderBy: [{dueDate: 'asc'}, {createdAt: 'desc'}],
    take: 50,
    where: {
      completed: false,
      OR: [{dueDate: {lte: new Date(`${tomorrow}T23:59:59`)}}],
    },
  });

  for (const task of tasks) {
    if (!isImportantTask(task) || isInactiveTask(task)) continue;
    const overdue = task.dueDate && task.dueDate.getTime() < new Date(`${today}T00:00:00`).getTime();
    const eventType = overdue ? 'task_important_overdue' : 'task_important_due';
    generated.push(
      await recordBusinessNotificationEvent(prisma, {
        entityId: task.id,
        entityType: 'task',
        fingerprint: `task:${task.id}:${overdue ? 'important-overdue' : 'important-due'}`,
        payload: {dueDate: task.dueDate, priority: task.priority},
        priority: overdue ? 'high' : 'normal',
        recommendedAction: 'open_task',
        reopenWhenCurrent: true,
        source: 'smart-generator',
        title: overdue ? 'Просроченная задача' : 'Задача скоро',
        message: task.title,
        type: eventType,
        urgency: overdue ? 20 : 8,
      }, upsertNotificationEvent),
    );
    if (overdue) {
      await prisma.notificationEvent.updateMany({
        data: {resolvedAt: now, status: 'resolved'},
        where: {fingerprint: `task:${task.id}:important-due`, status: {in: ACTIVE_STATUSES}},
      });
    }
  }

  const supplies = await prisma.supply.findMany({
    orderBy: [{updatedAt: 'desc'}],
    take: 100,
  });

  for (const supply of supplies) {
    const stock = toNumber(supply.stock);
    const minStock = toNumber(supply.minStock);
    if (stock === null || minStock === null || stock > minStock) continue;

    generated.push(
      await upsertNotificationEvent(prisma, {
        entityId: supply.id,
        entityType: 'supply',
        fingerprint: `supply:${supply.id}:low-stock`,
        payload: {minStock, orderUrl: supply.orderUrl, stock, unit: supply.unit},
        priority: stock <= 0 ? 'critical' : 'high',
        recommendedAction: supply.orderUrl ? 'order_supply' : 'open_supply',
        reopenWhenCurrent: true,
        source: 'smart-generator',
        title: stock <= 0 ? 'Материал закончился' : 'Материал заканчивается',
        message: `${supply.name}: ${stock} ${supply.unit || ''}`,
        type: 'supply_low_stock',
        urgency: stock <= 0 ? 20 : 12,
      }),
    );
  }

  const calendarEntries = await prisma.calendarEntry.findMany({
    orderBy: [{date: 'asc'}, {time: 'asc'}],
    take: 100,
    where: {
      date: {in: [today, tomorrow]},
      status: {notIn: ['cancelled', 'canceled', 'completed']},
    },
  });

  for (const entry of calendarEntries) {
    if (!isActionableVisitUpcomingEvent(
      {type: 'visit_upcoming', payload: {date: entry.date, time: entry.time}},
      entry,
      now,
      upcomingVisitMinutes,
    )) {
      continue;
    }

    const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
    const clientName = cleanString(payload.client || payload.clientName);
    generated.push(
      await upsertNotificationEvent(prisma, {
        clientName,
        entityId: entry.id,
        entityType: 'calendar_entry',
        fingerprint: `visit:${entry.id}:upcoming`,
        payload: {date: entry.date, time: entry.time, ...payload},
        priority: entry.date === today ? 'high' : 'normal',
        recommendedAction: 'open_calendar',
        source: 'smart-generator',
        title: entry.date === today ? 'Визит сегодня' : 'Визит завтра',
        message: `${clientName || 'Клиент'} · ${entry.time || ''}`,
        type: 'visit_upcoming',
        urgency: entry.date === today ? 15 : 6,
      }),
    );
  }

  const clientPackages = await prisma.clientPackage.findMany({
    orderBy: [{updatedAt: 'desc'}],
    take: 100,
    where: {status: {notIn: ['closed', 'expired', 'cancelled']}},
  });

  for (const item of clientPackages) {
    const remaining = toNumber(item.remainingVisits);
    if (remaining === null || remaining > 1) continue;

    generated.push(
      await upsertNotificationEvent(prisma, {
        clientId: item.clientId,
        clientName: item.clientName,
        entityId: item.id,
        entityType: 'client_package',
        fingerprint: `client-package:${item.id}:ending`,
        payload: {packageName: item.packageName, remainingVisits: remaining, service: item.service},
        priority: remaining <= 0 ? 'high' : 'normal',
        recommendedAction: 'offer_package',
        reopenWhenCurrent: true,
        source: 'smart-generator',
        title: remaining <= 0 ? 'Пакет закончился' : 'Пакет заканчивается',
        message: `${item.clientName || 'Клиент'} · ${item.packageName || 'пакет'} · осталось ${remaining}`,
        type: 'package_ending',
        clientValue: toNumber(item.price) || 0,
        urgency: remaining <= 0 ? 15 : 8,
      }),
    );
  }

  const certificates = await prisma.certificate.findMany({
    orderBy: [{updatedAt: 'desc'}],
    take: 100,
    where: {status: {notIn: ['closed', 'expired', 'cancelled']}},
  });

  for (const certificate of certificates) {
    const remainingBalance = toNumber(certificate.remainingBalance);
    const expiresIn = daysUntil(certificate.expiryDate, now);
    const isLowBalance = remainingBalance !== null && remainingBalance > 0 && remainingBalance <= 50;
    const expiresSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 14;
    if (!isLowBalance && !expiresSoon) continue;

    generated.push(
      await upsertNotificationEvent(prisma, {
        clientId: certificate.clientId || certificate.recipientId,
        clientName: certificate.recipientName || certificate.clientName,
        entityId: certificate.id,
        entityType: 'certificate',
        fingerprint: `certificate:${certificate.id}:${expiresSoon ? 'expires' : 'low-balance'}`,
        payload: {code: certificate.code, expiresIn, expiryDate: certificate.expiryDate, remainingBalance},
        priority: expiresSoon && expiresIn <= 3 ? 'high' : 'normal',
        recommendedAction: 'contact_client',
        reopenWhenCurrent: true,
        source: 'smart-generator',
        title: expiresSoon ? 'Сертификат скоро истекает' : 'Сертификат почти использован',
        message: `${certificate.recipientName || certificate.clientName || 'Клиент'} · ${certificate.code}`,
        type: expiresSoon ? 'certificate_expiring' : 'certificate_low_balance',
        moneyImpact: remainingBalance || 0,
        urgency: expiresSoon ? 14 - expiresIn : 5,
      }),
    );
  }

  const waitlist = await prisma.waitlistEntry.findMany({
    orderBy: [{createdAt: 'asc'}],
    take: 50,
    where: {status: {notIn: ['closed', 'cancelled', 'done']}},
  });

  for (const entry of waitlist) {
    generated.push(
      await upsertNotificationEvent(prisma, {
        clientId: entry.clientId,
        clientName: entry.clientName,
        entityId: entry.id,
        entityType: 'waitlist_entry',
        fingerprint: `waitlist:${entry.id}:active`,
        payload: {
          preferredDate: entry.preferredDate,
          preferredMaster: entry.preferredMaster,
          preferredService: entry.preferredService,
          preferredTimeFrom: entry.preferredTimeFrom,
          preferredTimeTo: entry.preferredTimeTo,
        },
        priority: 'normal',
        recommendedAction: 'match_waitlist',
        reopenWhenCurrent: true,
        source: 'smart-generator',
        title: 'Клиент в листе ожидания',
        message: `${entry.clientName || 'Клиент'} · ${entry.preferredService || 'любая услуга'}`,
        type: 'waitlist_active',
        urgency: 4,
      }),
    );
  }

  // Retention/Inactive Clients
  const inactiveDaysLimit = Math.max(7, Number(settings.inactiveClientDays) || 45);
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      visits: {
        select: { scheduledAt: true },
        orderBy: { scheduledAt: 'desc' },
        take: 1,
      },
    },
  });

  for (const client of clients) {
    let lastVisitDate;
    if (client.visits.length > 0 && client.visits[0].scheduledAt) {
      lastVisitDate = client.visits[0].scheduledAt;
    } else {
      lastVisitDate = client.createdAt;
    }

    if (!lastVisitDate) continue;

    const daysAbsent = Math.floor((now.getTime() - lastVisitDate.getTime()) / 86400000);
    if (daysAbsent >= inactiveDaysLimit) {
      generated.push(
        await upsertNotificationEvent(prisma, {
          clientId: client.id,
          clientName: client.name,
          entityId: String(client.id),
          entityType: 'client',
          fingerprint: `client:${client.id}:inactive`,
          payload: { daysAbsent, lastVisitDate: lastVisitDate.toISOString() },
          priority: daysAbsent >= inactiveDaysLimit * 2 ? 'high' : 'normal',
          recommendedAction: 'contact_client',
          reopenWhenCurrent: true,
          source: 'smart-generator',
          title: 'Давно не было визитов',
          message: `${client.name} · отсутствовал ${daysAbsent} дней`,
          type: 'client_inactive',
          urgency: Math.min(20, Math.floor(daysAbsent / 10)),
        })
      );
    }
  }

  return {
    count: generated.length,
    events: generated,
  };
};

const appendActionHistory = (current, action) => {
  const history = Array.isArray(current) ? current : [];
  return [
    ...history.slice(-49),
    {
      ...action,
      at: new Date().toISOString(),
    },
  ];
};

const updateNotificationEvent = async (prisma, id, patch = {}) => {
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    const error = new Error('notification event id is invalid');
    error.status = 422;
    throw error;
  }

  const current = await prisma.notificationEvent.findUnique({where: {id: eventId}});
  if (!current) {
    const error = new Error('notification event not found');
    error.status = 404;
    throw error;
  }

  const status = cleanString(patch.status);
  const next = {};

  if (status) {
    next.status = status;
    if (status === 'resolved' || status === 'dismissed') {
      next.resolvedAt = new Date();
    }
    if (status === 'seen') {
      next.lastSeenAt = new Date();
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'snoozedUntil')) {
    next.snoozedUntil = parseDate(patch.snoozedUntil);
    if (next.snoozedUntil) next.status = 'snoozed';
  }

  if (patch.action) {
    next.actionHistory = appendActionHistory(current.actionHistory, {
      action: cleanString(patch.action) || 'update',
      meta: patch.actionMeta && typeof patch.actionMeta === 'object' ? patch.actionMeta : {},
    });
  }

  return prisma.notificationEvent.update({
    data: next,
    where: {id: eventId},
  });
};

const mergeRecipientState = (event, recipient) => ({
  ...event,
  actionHistory: recipient?.actionHistory ?? event.actionHistory,
  lastSeenAt: recipient?.lastSeenAt ?? null,
  resolvedAt: recipient?.resolvedAt ?? null,
  snoozedUntil: recipient?.snoozedUntil ?? null,
  status: recipient?.status || 'new',
});

const listNotificationEventsForUser = async (prisma, userId, options = {}) => {
  const numericUserId = Number(userId);
  const requestedStatus = options.status || 'active';
  const requestedLimit = Math.max(1, Math.min(100, Number(options.limit) || 50));
  const requestedOffset = Math.max(0, Math.min(500, Number(options.offset) || 0));
  const events = await listNotificationEvents(prisma, {
    ...options,
    limit: 500,
    status: requestedStatus === 'all' ? 'all' : 'active',
  });
  if (!Number.isInteger(numericUserId) || events.length === 0) return events;

  const recipients = await prisma.notificationRecipient.findMany({
    where: {notificationEventId: {in: events.map((event) => event.id)}, userId: numericUserId},
  });
  const byEventId = new Map(recipients.map((recipient) => [recipient.notificationEventId, recipient]));
  const now = options.now || new Date();

  const personalized = events
    .map((event) => mergeRecipientState(event, byEventId.get(event.id)))
    .filter((event) => requestedStatus === 'all'
      || (requestedStatus === 'active'
        ? ACTIVE_STATUSES.includes(event.status) && (!event.snoozedUntil || event.snoozedUntil <= now)
        : event.status === requestedStatus));

  const categoryOrder = {
    [CATEGORY.CRITICAL]: 0,
    [CATEGORY.ACTION]: 1,
    [CATEGORY.OPPORTUNITY]: 2,
    [CATEGORY.INFORMATION]: 3,
  };
  const classified = await classifyNotificationEvents(prisma, personalized, {now});
  const selected = classified
    .filter((event) => requestedStatus !== 'active'
      || event.isCurrent
      || event.category === CATEGORY.INFORMATION)
    .sort((left, right) => {
      const categoryDifference = categoryOrder[left.category] - categoryOrder[right.category];
      if (categoryDifference !== 0) return categoryDifference;
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(requestedOffset, requestedOffset + requestedLimit);
  const selectedWithoutRecipient = selected.filter((event) => !byEventId.has(event.id));
  if (selectedWithoutRecipient.length > 0) {
    await prisma.notificationRecipient.createMany({
      data: selectedWithoutRecipient.map((event) => ({notificationEventId: event.id, userId: numericUserId})),
      skipDuplicates: true,
    });
  }
  return selected;
};

const getNotificationCountsForUser = async (prisma, userId, {now = new Date()} = {}) => {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    const error = new Error('notification recipient is invalid');
    error.status = 422;
    throw error;
  }

  const events = await prisma.notificationEvent.findMany({
    orderBy: [{createdAt: 'desc'}],
    where: {
      status: {in: ACTIVE_STATUSES},
      OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
    },
  });
  if (events.length === 0) {
    return {attention: 0, critical: 0, action: 0, opportunity: 0, information: 0, stale: 0, total: 0};
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: {notificationEventId: {in: events.map((event) => event.id)}, userId: numericUserId},
  });
  const recipientByEventId = new Map(recipients.map((recipient) => [recipient.notificationEventId, recipient]));
  const classified = await classifyNotificationEvents(prisma, events, {now});
  const counts = {attention: 0, critical: 0, action: 0, opportunity: 0, information: 0, stale: 0, total: 0};

  classified.forEach((event) => {
    const recipient = recipientByEventId.get(event.id);
    if (!isRecipientVisible(recipient, now)) return;
    if (!event.isCurrent) {
      counts.stale += 1;
      return;
    }
    counts.total += 1;
    counts[event.category] += 1;
    if (event.category === CATEGORY.CRITICAL || event.category === CATEGORY.ACTION) {
      counts.attention += 1;
    }
  });

  return counts;
};

const updateNotificationRecipient = async (prisma, userId, id, patch = {}) => {
  const eventId = Number(id);
  const numericUserId = Number(userId);
  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(numericUserId) || numericUserId <= 0) {
    const error = new Error('notification recipient is invalid');
    error.status = 422;
    throw error;
  }
  const event = await prisma.notificationEvent.findUnique({where: {id: eventId}});
  if (!event) {
    const error = new Error('notification event not found');
    error.status = 404;
    throw error;
  }
  const current = await prisma.notificationRecipient.upsert({
    create: {notificationEventId: eventId, userId: numericUserId},
    update: {},
    where: {notificationEventId_userId: {notificationEventId: eventId, userId: numericUserId}},
  });
  const status = cleanString(patch.status);
  const data = {};
  if (status) {
    data.status = status;
    if (['resolved', 'dismissed'].includes(status)) data.resolvedAt = new Date();
    if (status === 'seen') data.lastSeenAt = new Date();
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'snoozedUntil')) {
    data.snoozedUntil = parseDate(patch.snoozedUntil);
    if (data.snoozedUntil) data.status = 'snoozed';
  }
  if (patch.action) {
    data.actionHistory = appendActionHistory(current.actionHistory, {
      action: cleanString(patch.action) || 'update',
      meta: patch.actionMeta && typeof patch.actionMeta === 'object' ? patch.actionMeta : {},
    });
  }
  const recipient = await prisma.notificationRecipient.update({data, where: {id: current.id}});
  return mergeRecipientState(event, recipient);
};

module.exports = {
  classifyNotificationEvents,
  generateSmartNotificationEvents,
  getNotificationCountsForUser,
  listNotificationEvents,
  listNotificationEventsForUser,
  normalizeNotificationEventInput,
  reconcileNotificationEventLifecycle,
  scoreNotificationEvent,
  updateNotificationEvent,
  updateNotificationRecipient,
  upsertNotificationEvent,
  _private: {
    isActionableVisitUpcomingEvent,
    isStaleVisitUpcomingEvent,
    resolveStaleVisitUpcomingEvents,
    isImportantTask,
    isInactiveTask,
    toIsoDate,
  },
};
