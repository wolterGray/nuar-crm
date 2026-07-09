const PRIORITY_SCORE = {
  critical: 100,
  high: 75,
  normal: 45,
  low: 20,
};

const ACTIVE_STATUSES = ['new', 'seen', 'snoozed'];

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

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toIsoDate = (date = new Date()) => date.toISOString().slice(0, 10);

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

const listNotificationEvents = (prisma, {limit = 50, status = 'active'} = {}) => {
  const take = Math.max(1, Math.min(100, Number(limit) || 50));
  const now = new Date();
  const where =
    status === 'all'
      ? {}
      : status === 'active'
        ? {
            status: {in: ACTIVE_STATUSES},
            OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
          }
        : {status};

  return prisma.notificationEvent.findMany({
    orderBy: [{score: 'desc'}, {createdAt: 'desc'}],
    take,
    where,
  });
};

const upsertNotificationEvent = (prisma, input) => {
  const data = normalizeNotificationEventInput(input);

  return prisma.notificationEvent.upsert({
    create: data,
    update: {
      clientId: data.clientId,
      clientName: data.clientName,
      entityId: data.entityId,
      entityType: data.entityType,
      message: data.message,
      payload: data.payload,
      priority: data.priority,
      recommendedAction: data.recommendedAction,
      score: data.score,
      source: data.source,
      title: data.title,
      type: data.type,
    },
    where: {fingerprint: data.fingerprint},
  });
};

const generateSmartNotificationEvents = async (prisma, {now = new Date()} = {}) => {
  const settings = await prisma.systemState
    .findUnique({where: {key: 'appSettings'}})
    .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
    .catch(() => ({}));

  const today = toIsoDate(now);
  const tomorrow = toIsoDate(new Date(now.getTime() + 86400000));
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
    const overdue = task.dueDate && task.dueDate.getTime() < new Date(`${today}T00:00:00`).getTime();
    generated.push(
      await upsertNotificationEvent(prisma, {
        entityId: task.id,
        entityType: 'task',
        fingerprint: `task:${task.id}:due`,
        payload: {dueDate: task.dueDate, priority: task.priority},
        priority: overdue ? 'high' : 'normal',
        recommendedAction: 'open_task',
        source: 'smart-generator',
        title: overdue ? 'Просроченная задача' : 'Задача скоро',
        message: task.title,
        type: 'task_due',
        urgency: overdue ? 20 : 8,
      }),
    );
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
    let lastVisitDate = null;
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

module.exports = {
  generateSmartNotificationEvents,
  listNotificationEvents,
  normalizeNotificationEventInput,
  scoreNotificationEvent,
  updateNotificationEvent,
  upsertNotificationEvent,
};
