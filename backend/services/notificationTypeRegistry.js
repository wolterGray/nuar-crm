const ACTIVE_EVENT_STATUSES = ['new', 'seen', 'snoozed'];
const TERMINAL_ENTITY_STATUSES = new Set([
  'archive',
  'archived',
  'booked',
  'cancelled',
  'canceled',
  'closed',
  'completed',
  'deleted',
  'done',
  'expired',
  'no_show',
  'rejected',
]);

const CATEGORY = Object.freeze({
  ACTION: 'action',
  CRITICAL: 'critical',
  INFORMATION: 'information',
  OPPORTUNITY: 'opportunity',
});

const TYPE_RULES = Object.freeze({
  booking_request: {category: CATEGORY.ACTION},
  client_inactive: {category: CATEGORY.OPPORTUNITY},
  delivery_failed: {category: CATEGORY.CRITICAL},
  package_ending: {category: CATEGORY.OPPORTUNITY},
  supply_low_stock: {category: CATEGORY.ACTION},
  task_due: {category: CATEGORY.ACTION},
  task_important_due: {category: CATEGORY.ACTION},
  task_important_overdue: {category: CATEGORY.ACTION},
  visit_cancelled: {category: CATEGORY.INFORMATION},
  visit_created: {category: CATEGORY.INFORMATION},
  visit_rescheduled: {category: CATEGORY.INFORMATION},
  visit_upcoming: {category: CATEGORY.INFORMATION},
  waitlist_active: {category: CATEGORY.OPPORTUNITY},
});

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase();

const getNotificationCategory = (event = {}) => {
  const explicit = normalizeStatus(event.category ?? event.payload?.category);
  if (Object.values(CATEGORY).includes(explicit)) return explicit;
  if (String(event.type ?? '').startsWith('certificate_')) return CATEGORY.OPPORTUNITY;
  return TYPE_RULES[event.type]?.category || CATEGORY.INFORMATION;
};

const isRecipientVisible = (recipient, now = new Date()) => {
  if (!recipient) return true;
  if (!ACTIVE_EVENT_STATUSES.includes(recipient.status)) return false;
  return !recipient.snoozedUntil || new Date(recipient.snoozedUntil) <= now;
};

const isTaskCurrent = (event, task, now) => {
  if (!task || task.completed || TERMINAL_ENTITY_STATUSES.has(normalizeStatus(task.status))) return false;
  if (!task.dueDate) return false;
  const dueAt = new Date(task.dueDate);
  if (Number.isNaN(dueAt.getTime())) return false;
  if (event.type === 'task_important_due') {
    return dueAt.getTime() <= now.getTime() + 86400000;
  }
  return dueAt.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const isEventCurrent = (event, linked = {}, now = new Date()) => {
  const category = getNotificationCategory(event);
  if (category === CATEGORY.INFORMATION) return true;

  if (['task_due', 'task_important_due', 'task_important_overdue'].includes(event.type)) {
    return isTaskCurrent(event, linked.task, now);
  }
  if (event.type === 'supply_low_stock') {
    if (!linked.supply) return false;
    return Number(linked.supply.stock) <= Number(linked.supply.minStock);
  }
  if (event.type === 'package_ending') {
    if (!linked.clientPackage || TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.clientPackage.status))) return false;
    return Number(linked.clientPackage.remainingVisits) <= 1;
  }
  if (event.type === 'client_inactive') {
    if (!linked.client) return false;
    const generatedFrom = new Date(event.payload?.lastVisitDate || 0);
    const latestVisit = linked.client.visits?.[0]?.scheduledAt
      ? new Date(linked.client.visits[0].scheduledAt)
      : null;
    return !latestVisit || Number.isNaN(generatedFrom.getTime()) || latestVisit <= generatedFrom;
  }
  if (event.type === 'waitlist_active') {
    return Boolean(linked.waitlistEntry)
      && !TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.waitlistEntry.status));
  }
  if (String(event.type ?? '').startsWith('certificate_')) {
    return Boolean(linked.certificate)
      && !TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.certificate.status));
  }
  return true;
};

const withClassification = (event, linked, now = new Date()) => ({
  ...event,
  category: getNotificationCategory(event),
  isCurrent: isEventCurrent(event, linked, now),
});

module.exports = {
  ACTIVE_EVENT_STATUSES,
  CATEGORY,
  TYPE_RULES,
  getNotificationCategory,
  isEventCurrent,
  isRecipientVisible,
  withClassification,
  _private: {isTaskCurrent, normalizeStatus},
};
