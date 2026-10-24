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
});

// Allowed notification types strictly limited to operational events
const TYPE_RULES = Object.freeze({
  booking_request: {category: CATEGORY.ACTION},
  site_booking_request: {category: CATEGORY.ACTION},
  visit_created: {category: CATEGORY.INFORMATION},
  visit_rescheduled: {category: CATEGORY.INFORMATION},
  visit_cancelled: {category: CATEGORY.INFORMATION},
  waitlist_entry: {category: CATEGORY.ACTION},
  waitlist_active: {category: CATEGORY.ACTION},
  waitlist_match: {category: CATEGORY.ACTION},
  supply_low_stock: {category: CATEGORY.ACTION},
  supply_out_of_stock: {category: CATEGORY.CRITICAL},
});

const ALLOWED_NOTIFICATION_TYPES = new Set(Object.keys(TYPE_RULES));

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase();

const isAllowedNotificationType = (type) => ALLOWED_NOTIFICATION_TYPES.has(String(type ?? '').trim());

const getNotificationCategory = (event = {}) => {
  const explicit = normalizeStatus(event.category ?? event.payload?.category);
  if (Object.values(CATEGORY).includes(explicit)) return explicit;
  return TYPE_RULES[event.type]?.category || CATEGORY.INFORMATION;
};

const isRecipientVisible = (recipient, now = new Date()) => {
  if (!recipient) return true;
  if (!ACTIVE_EVENT_STATUSES.includes(recipient.status)) return false;
  return !recipient.snoozedUntil || new Date(recipient.snoozedUntil) <= now;
};

const isEventCurrent = (event, linked = {}, now = new Date()) => {
  if (!isAllowedNotificationType(event.type)) {
    return false;
  }

  if (event.type === 'supply_out_of_stock') {
    if (!linked.supply) return false;
    return Number(linked.supply.stock) <= 0;
  }

  if (event.type === 'supply_low_stock') {
    if (!linked.supply) return false;
    const stock = Number(linked.supply.stock);
    const minStock = Number(linked.supply.minStock);
    return stock > 0 && stock <= minStock;
  }

  if (['waitlist_entry', 'waitlist_active', 'waitlist_match'].includes(event.type)) {
    return Boolean(linked.waitlistEntry)
      && !TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.waitlistEntry.status));
  }

  if (event.type === 'site_booking_request') {
    if (linked.siteBookingRequest && TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.siteBookingRequest.status))) {
      return false;
    }
    if (linked.waitlistEntry && TERMINAL_ENTITY_STATUSES.has(normalizeStatus(linked.waitlistEntry.status))) {
      return false;
    }
    return true;
  }

  // Visit events TTL: 48 hours from creation
  if (['visit_created', 'visit_rescheduled', 'visit_cancelled'].includes(event.type)) {
    const createdAt = event.createdAt ? new Date(event.createdAt) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 48) return false;
    }
    return true;
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
  ALLOWED_NOTIFICATION_TYPES,
  CATEGORY,
  TYPE_RULES,
  getNotificationCategory,
  isAllowedNotificationType,
  isEventCurrent,
  isRecipientVisible,
  withClassification,
  _private: {normalizeStatus},
};
