const {
  ACTIVE_EVENT_STATUSES,
  ALLOWED_NOTIFICATION_TYPES,
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
  return PRIORITY_SCORE[priority] || PRIORITY_SCORE.normal;
};

const normalizeNotificationEventInput = (input = {}) => {
  const priority = normalizePriority(input.priority);
  const source = cleanString(input.source) || 'crm';
  const type = cleanString(input.type) || 'generic';
  const fingerprint = cleanString(input.fingerprint) || buildFingerprint({...input, source, type});
  const title = cleanString(input.title) || 'Уведомление';
  const message = cleanString(input.message) || title;

  return {
    clientId: Number.isInteger(Number(input.clientId)) && Number(input.clientId) > 0 ? Number(input.clientId) : null,
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

const autoResolveExpiredAndStaleNotificationEvents = async (prisma, now = new Date()) => {
  if (!prisma?.notificationEvent?.findMany) return;

  try {
    // 1. Resolve deprecated / disallowed junk notification types
    const legacyEvents = await prisma.notificationEvent.findMany({
      select: {id: true},
      where: {
        status: {in: ACTIVE_STATUSES},
        type: {notIn: [...ALLOWED_NOTIFICATION_TYPES]},
      },
    });
    if (legacyEvents.length > 0) {
      const legacyIds = legacyEvents.map((e) => e.id);
      await prisma.notificationEvent.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_deprecated_type', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {id: {in: legacyIds}},
      });
      await prisma.notificationRecipient.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_deprecated_type', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {notificationEventId: {in: legacyIds}, status: {in: ACTIVE_STATUSES}},
      });
    }

    // 2. TTL: visit_created, visit_rescheduled, visit_cancelled > 48h
    const ttl48hCutoff = new Date(now.getTime() - 48 * 3600 * 1000);
    const expiredVisitEvents = await prisma.notificationEvent.findMany({
      select: {id: true},
      where: {
        createdAt: {lt: ttl48hCutoff},
        status: {in: ACTIVE_STATUSES},
        type: {in: ['visit_created', 'visit_rescheduled', 'visit_cancelled']},
      },
    });
    if (expiredVisitEvents.length > 0) {
      const visitIds = expiredVisitEvents.map((e) => e.id);
      await prisma.notificationEvent.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_ttl_48h', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {id: {in: visitIds}},
      });
      await prisma.notificationRecipient.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_ttl_48h', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {notificationEventId: {in: visitIds}, status: {in: ACTIVE_STATUSES}},
      });
    }

    // 3. TTL: waitlist_match > 24h
    const ttl24hCutoff = new Date(now.getTime() - 24 * 3600 * 1000);
    const expiredWaitlistMatch = await prisma.notificationEvent.findMany({
      select: {id: true},
      where: {
        createdAt: {lt: ttl24hCutoff},
        status: {in: ACTIVE_STATUSES},
        type: 'waitlist_match',
      },
    });
    if (expiredWaitlistMatch.length > 0) {
      const matchIds = expiredWaitlistMatch.map((e) => e.id);
      await prisma.notificationEvent.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_ttl_24h', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {id: {in: matchIds}},
      });
      await prisma.notificationRecipient.updateMany({
        data: {
          actionHistory: [{action: 'auto_resolve_ttl_24h', at: now.toISOString()}],
          resolvedAt: now,
          status: 'resolved',
        },
        where: {notificationEventId: {in: matchIds}, status: {in: ACTIVE_STATUSES}},
      });
    }

    // 4. State reconciliation: Supplies with stock > minStock or deleted
    const activeSupplyEvents = await prisma.notificationEvent.findMany({
      where: {
        status: {in: ACTIVE_STATUSES},
        type: {in: ['supply_low_stock', 'supply_out_of_stock']},
      },
    });
    if (activeSupplyEvents.length > 0) {
      const supplyIds = activeSupplyEvents
        .map((e) => Number(e.entityId))
        .filter((id) => Number.isInteger(id) && id > 0);
      const supplies = supplyIds.length > 0
        ? await prisma.supply.findMany({where: {id: {in: [...new Set(supplyIds)]}}})
        : [];
      const supplyById = new Map(supplies.map((s) => [Number(s.id), s]));
      const resolvedSupplyEventIds = activeSupplyEvents
        .filter((event) => {
          const supply = supplyById.get(Number(event.entityId));
          if (!supply) return true; // deleted supply
          const stock = Number(supply.stock);
          const minStock = Number(supply.minStock);
          if (event.type === 'supply_out_of_stock' && stock > 0) return true;
          if (event.type === 'supply_low_stock' && stock > minStock) return true;
          return false;
        })
        .map((e) => e.id);
      if (resolvedSupplyEventIds.length > 0) {
        await prisma.notificationEvent.updateMany({
          data: {
            actionHistory: [{action: 'auto_resolve_restocked_or_deleted', at: now.toISOString()}],
            resolvedAt: now,
            status: 'resolved',
          },
          where: {id: {in: resolvedSupplyEventIds}},
        });
        await prisma.notificationRecipient.updateMany({
          data: {
            actionHistory: [{action: 'auto_resolve_restocked_or_deleted', at: now.toISOString()}],
            resolvedAt: now,
            status: 'resolved',
          },
          where: {notificationEventId: {in: resolvedSupplyEventIds}, status: {in: ACTIVE_STATUSES}},
        });
      }
    }

    // 5. State reconciliation: Waitlist entries closed, deleted, booked, cancelled
    const activeWaitlistEvents = await prisma.notificationEvent.findMany({
      where: {
        status: {in: ACTIVE_STATUSES},
        type: {in: ['waitlist_entry', 'waitlist_active', 'waitlist_match']},
      },
    });
    if (activeWaitlistEvents.length > 0) {
      const waitlistIds = activeWaitlistEvents
        .map((e) => Number(e.entityId))
        .filter((id) => Number.isInteger(id) && id > 0);
      const entries = waitlistIds.length > 0
        ? await prisma.waitlistEntry.findMany({where: {id: {in: [...new Set(waitlistIds)]}}})
        : [];
      const entryById = new Map(entries.map((w) => [Number(w.id), w]));
      const terminalStatuses = new Set([
        'archive', 'archived', 'booked', 'cancelled', 'canceled',
        'closed', 'completed', 'deleted', 'done', 'expired', 'no_show', 'rejected',
      ]);
      const resolvedWaitlistIds = activeWaitlistEvents
        .filter((event) => {
          const entry = entryById.get(Number(event.entityId));
          if (!entry) return true;
          return terminalStatuses.has(String(entry.status ?? '').trim().toLowerCase());
        })
        .map((e) => e.id);
      if (resolvedWaitlistIds.length > 0) {
        await prisma.notificationEvent.updateMany({
          data: {
            actionHistory: [{action: 'auto_resolve_terminal_waitlist', at: now.toISOString()}],
            resolvedAt: now,
            status: 'resolved',
          },
          where: {id: {in: resolvedWaitlistIds}},
        });
        await prisma.notificationRecipient.updateMany({
          data: {
            actionHistory: [{action: 'auto_resolve_terminal_waitlist', at: now.toISOString()}],
            resolvedAt: now,
            status: 'resolved',
          },
          where: {notificationEventId: {in: resolvedWaitlistIds}, status: {in: ACTIVE_STATUSES}},
        });
      }
    }
  } catch (error) {
    console.error('autoResolveExpiredAndStaleNotificationEvents error:', error);
  }
};

const filterEventsByRole = (events, user) => {
  if (!user || user.role === 'owner' || user.role === 'admin') {
    return events;
  }

  if (user.role === 'staff') {
    const userEmployeeId = Number(user.employeeId);
    return events.filter((event) => {
      // Staff never sees supplies or general waitlist
      if (String(event.type).startsWith('supply_')) return false;
      const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const targetEmpId = Number(payload.employeeId || payload.masterId || payload.preferredMasterId);
      if (Number.isInteger(userEmployeeId) && userEmployeeId > 0 && targetEmpId === userEmployeeId) {
        return true;
      }
      return false;
    });
  }

  return events;
};

const listNotificationEvents = async (prisma, {limit = 50, now = new Date(), status = 'active'} = {}) => {
  const take = Math.max(1, Math.min(500, Number(limit) || 50));
  const internalTake = Math.min(500, Math.max(take * 3, take));
  if (status === 'active') {
    await autoResolveExpiredAndStaleNotificationEvents(prisma, now);
  }
  const where =
    status === 'all'
      ? {type: {in: [...ALLOWED_NOTIFICATION_TYPES]}}
      : status === 'active'
        ? {
            status: {in: ACTIVE_STATUSES},
            type: {in: [...ALLOWED_NOTIFICATION_TYPES]},
            OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
          }
        : {status, type: {in: [...ALLOWED_NOTIFICATION_TYPES]}};

  const events = await prisma.notificationEvent.findMany({
    orderBy: [{score: 'desc'}, {createdAt: 'desc'}],
    take: internalTake,
    where,
  });

  return events.slice(0, take);
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
  const supplyIds = getEntityIds(events, 'supply');
  const waitlistIds = getEntityIds(events, 'waitlist_entry');

  const [supplies, waitlistEntries] = await Promise.all([
    supplyIds.length ? prisma.supply.findMany({where: {id: {in: supplyIds}}}) : [],
    waitlistIds.length ? prisma.waitlistEntry.findMany({where: {id: {in: waitlistIds}}}) : [],
  ]);

  return {
    supplies: new Map(supplies.map((item) => [Number(item.id), item])),
    waitlistEntries: new Map(waitlistEntries.map((item) => [Number(item.id), item])),
  };
};

const getLinkedStateForEvent = (event, state) => ({
  supply: state.supplies.get(Number(event.entityId)),
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
  await autoResolveExpiredAndStaleNotificationEvents(prisma, now);
  const events = await prisma.notificationEvent.findMany({
    where: {status: {in: ACTIVE_STATUSES}},
  });
  const classified = await classifyNotificationEvents(prisma, events, {now});
  const stale = classified.filter(
    (event) => !event.isCurrent,
  );
  const byType = stale.reduce((counts, event) => {
    counts[event.type] = (counts[event.type] || 0) + 1;
    return counts;
  }, {});

  if (commit && stale.length > 0) {
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
  await autoResolveExpiredAndStaleNotificationEvents(prisma, now);

  const generated = [];

  const supplies = await prisma.supply.findMany({
    orderBy: [{updatedAt: 'desc'}],
    take: 100,
  });

  for (const supply of supplies) {
    const stock = toNumber(supply.stock);
    const minStock = toNumber(supply.minStock);
    if (stock === null || minStock === null) continue;

    if (stock <= 0) {
      generated.push(
        await upsertNotificationEvent(prisma, {
          entityId: String(supply.id),
          entityType: 'supply',
          fingerprint: `supply:${supply.id}:out-of-stock`,
          payload: {minStock, orderUrl: supply.orderUrl, stock, unit: supply.unit},
          priority: 'critical',
          recommendedAction: supply.orderUrl ? 'order_supply' : 'open_supply',
          reopenWhenCurrent: true,
          source: 'supply-tracker',
          title: 'Расходник закончился',
          message: `${supply.name}: 0 ${supply.unit || 'шт'} (минимум: ${minStock})`,
          type: 'supply_out_of_stock',
        }),
      );
      // Auto-resolve any previous low-stock event
      await prisma.notificationEvent.updateMany({
        data: {resolvedAt: now, status: 'resolved'},
        where: {fingerprint: `supply:${supply.id}:low-stock`, status: {in: ACTIVE_STATUSES}},
      });
    } else if (stock <= minStock) {
      generated.push(
        await upsertNotificationEvent(prisma, {
          entityId: String(supply.id),
          entityType: 'supply',
          fingerprint: `supply:${supply.id}:low-stock`,
          payload: {minStock, orderUrl: supply.orderUrl, stock, unit: supply.unit},
          priority: 'high',
          recommendedAction: supply.orderUrl ? 'order_supply' : 'open_supply',
          reopenWhenCurrent: true,
          source: 'supply-tracker',
          title: 'Заканчивается расходник',
          message: `${supply.name}: остаток ${stock} ${supply.unit || 'шт'} (минимум: ${minStock})`,
          type: 'supply_low_stock',
        }),
      );
      // Auto-resolve any previous out-of-stock event
      await prisma.notificationEvent.updateMany({
        data: {resolvedAt: now, status: 'resolved'},
        where: {fingerprint: `supply:${supply.id}:out-of-stock`, status: {in: ACTIVE_STATUSES}},
      });
    } else {
      // Stock is above minStock: auto-resolve both
      await prisma.notificationEvent.updateMany({
        data: {resolvedAt: now, status: 'resolved'},
        where: {
          fingerprint: {in: [`supply:${supply.id}:low-stock`, `supply:${supply.id}:out-of-stock`]},
          status: {in: ACTIVE_STATUSES},
        },
      });
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

const paginateNotificationEvents = (events, {limit, offset}) =>
  events.slice(offset, offset + limit);

const listNotificationEventsForUser = async (prisma, userId, options = {}) => {
  const numericUserId = Number(userId);
  const requestedStatus = options.status || 'active';
  const requestedLimit = Math.max(1, Math.min(100, Number(options.limit) || 50));
  const requestedOffset = Math.max(0, Math.min(500, Number(options.offset) || 0));

  const user = Number.isInteger(numericUserId) && numericUserId > 0 && typeof prisma?.user?.findUnique === 'function'
    ? await prisma.user.findUnique({where: {id: numericUserId}})
    : null;

  const rawEvents = await listNotificationEvents(prisma, {
    ...options,
    limit: 500,
    status: requestedStatus === 'all' ? 'all' : 'active',
  });

  const events = filterEventsByRole(rawEvents, user);

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
    [CATEGORY.INFORMATION]: 2,
  };
  const classified = await classifyNotificationEvents(prisma, personalized, {now});
  const ordered = classified
    .filter((event) => requestedStatus !== 'active'
      || event.isCurrent
      || event.category === CATEGORY.INFORMATION)
    .sort((left, right) => {
      const categoryDifference = (categoryOrder[left.category] ?? 2) - (categoryOrder[right.category] ?? 2);
      if (categoryDifference !== 0) return categoryDifference;
      if (right.score !== left.score) return right.score - left.score;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const selected = paginateNotificationEvents(ordered, {
    limit: requestedLimit,
    offset: requestedOffset,
  });
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

  await autoResolveExpiredAndStaleNotificationEvents(prisma, now);

  const user = typeof prisma?.user?.findUnique === 'function'
    ? await prisma.user.findUnique({where: {id: numericUserId}})
    : null;

  const rawEvents = await prisma.notificationEvent.findMany({
    orderBy: [{createdAt: 'desc'}],
    where: {
      status: {in: ACTIVE_STATUSES},
      type: {in: [...ALLOWED_NOTIFICATION_TYPES]},
      OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
    },
  });

  const events = filterEventsByRole(rawEvents, user);

  if (events.length === 0) {
    return {action: 0, attention: 0, critical: 0, information: 0, stale: 0, total: 0};
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where: {notificationEventId: {in: events.map((event) => event.id)}, userId: numericUserId},
  });
  const recipientByEventId = new Map(recipients.map((recipient) => [recipient.notificationEventId, recipient]));
  const classified = await classifyNotificationEvents(prisma, events, {now});
  const counts = {action: 0, attention: 0, critical: 0, information: 0, stale: 0, total: 0};

  classified.forEach((event) => {
    const recipient = recipientByEventId.get(event.id);
    if (!isRecipientVisible(recipient, now)) return;
    if (!event.isCurrent && event.category !== CATEGORY.INFORMATION) {
      counts.stale += 1;
      return;
    }
    counts.total += 1;
    if (counts[event.category] !== undefined) {
      counts[event.category] += 1;
    }
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
  autoResolveExpiredAndStaleNotificationEvents,
  classifyNotificationEvents,
  filterEventsByRole,
  generateSmartNotificationEvents,
  getNotificationCountsForUser,
  listNotificationEvents,
  listNotificationEventsForUser,
  normalizeNotificationEventInput,
  paginateNotificationEvents,
  reconcileNotificationEventLifecycle,
  scoreNotificationEvent,
  updateNotificationEvent,
  updateNotificationRecipient,
  upsertNotificationEvent,
  _private: {
    toIsoDate,
  },
};

