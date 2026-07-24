const {isSmsAutomationEnabled, normalizePhone, queueSmsDelivery} = require('./smsService');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SMS_COOLDOWN_DAYS = 7;

const cleanString = (value) => {
  const text = String(value ?? '').trim();
  return text || '';
};

const getAppSettings = async (prisma) =>
  prisma.systemState
    .findUnique({where: {key: 'appSettings'}})
    .then((row) => (row?.payload && typeof row.payload === 'object' ? row.payload : {}))
    .catch(() => ({}));

const parseTimeParts = (value, fallback) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(cleanString(value));
  if (!match) return fallback;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return {hours, minutes};
};

const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

const toMinutes = ({hours, minutes}) => hours * 60 + minutes;

const isWithinQuietHours = (date, settings = {}) => {
  if (settings.quietHoursEnabled === false) return false;

  const start = toMinutes(parseTimeParts(settings.quietHoursStart, {hours: 22, minutes: 0}));
  const end = toMinutes(parseTimeParts(settings.quietHoursEnd, {hours: 8, minutes: 0}));
  const current = minutesOfDay(date);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
};

const nextQuietHoursEnd = (date, settings = {}) => {
  const end = parseTimeParts(settings.quietHoursEnd, {hours: 8, minutes: 0});
  const next = new Date(date);
  next.setHours(end.hours, end.minutes, 0, 0);
  if (next <= date) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

const getEventChannels = (event) => {
  if (event.type === 'visit_upcoming') return ['bell', 'telegram'];
  if (event.type === 'task_due' || event.type === 'supply_low_stock') return ['bell'];
  if (event.type === 'waitlist_active') return ['bell'];
  if (event.type === 'package_ending' || event.type?.startsWith('certificate_')) return ['bell', 'sms'];
  return ['bell'];
};

const buildSmsMessage = (event, settings = {}) => {
  const studio = cleanString(settings.studioName) || 'NUAR';
  const name = cleanString(event.clientName) || 'Cześć';

  if (event.type === 'package_ending') {
    return `${name}, Twój pakiet w ${studio} jest prawie wykorzystany. Napisz do nas, jeśli chcesz zaplanować kolejną wizytę.`;
  }

  if (event.type === 'certificate_expiring') {
    return `${name}, Twój voucher w ${studio} niedługo wygasa. Umów wizytę, żeby spokojnie go wykorzystać.`;
  }

  if (event.type === 'certificate_low_balance') {
    return `${name}, na Twoim voucherze w ${studio} została niewielka kwota. Możemy pomóc dobrać usługę.`;
  }

  return '';
};

const hasRecentClientSms = async (prisma, phone, since) => {
  const recipient = normalizePhone(phone);
  if (!recipient) return true;

  const count = await prisma.notificationDelivery.count({
    where: {
      channel: 'sms',
      createdAt: {gte: since},
      recipient,
      status: {in: ['pending', 'retrying', 'sent']},
    },
  });

  return count > 0;
};

const planNotificationDeliveries = async (prisma, {commit = false, limit = 50, now = new Date()} = {}) => {
  const settings = await getAppSettings(prisma);
  const take = Math.max(1, Math.min(100, Number(limit) || 50));
  const events = await prisma.notificationEvent.findMany({
    include: {client: true, deliveries: true},
    orderBy: [{score: 'desc'}, {createdAt: 'desc'}],
    take,
    where: {
      OR: [{snoozedUntil: null}, {snoozedUntil: {lte: now}}],
      status: {in: ['new', 'seen']},
    },
  });

  const quiet = isWithinQuietHours(now, settings);
  const scheduledAt = quiet ? nextQuietHoursEnd(now, settings) : now;
  const cooldownDays = Math.max(1, Number(settings.notificationSmsCooldownDays) || DEFAULT_SMS_COOLDOWN_DAYS);
  const cooldownSince = new Date(now.getTime() - cooldownDays * DAY_MS);
  const autoSmsEnabled =
    settings.smartNotificationAutoSmsEnabled === true &&
    isSmsAutomationEnabled(settings);
  const plans = [];
  const queued = [];

  for (const event of events) {
    const channels = getEventChannels(event);
    const clientPhone = event.client?.phone || event.payload?.phone || '';
    const normalizedPhone = normalizePhone(clientPhone);
    const hasSmsDelivery = event.deliveries.some((delivery) => delivery.channel === 'sms');
    const smsMessage = buildSmsMessage(event, settings);
    const smsBlockedReasons = [];

    if (!channels.includes('sms')) smsBlockedReasons.push('sms-not-recommended');
    if (!normalizedPhone) smsBlockedReasons.push('missing-phone');
    if (!smsMessage) smsBlockedReasons.push('missing-template');
    if (hasSmsDelivery) smsBlockedReasons.push('already-queued');
    if (normalizedPhone && await hasRecentClientSms(prisma, normalizedPhone, cooldownSince)) {
      smsBlockedReasons.push('cooldown');
    }
    if (!autoSmsEnabled) smsBlockedReasons.push('auto-sms-disabled');

    const smsPlan = {
      blockedReasons: smsBlockedReasons,
      channel: 'sms',
      enabled: smsBlockedReasons.length === 0,
      message: smsMessage,
      recipient: normalizedPhone,
      scheduledAt: scheduledAt.toISOString(),
    };

    if (commit && smsPlan.enabled) {
      const delivery = await queueSmsDelivery({
        message: smsMessage,
        notificationEventId: event.id,
        phone: normalizedPhone,
        scheduledAt,
        status: 'pending',
        templateKey: event.type,
      });
      queued.push(delivery);
    }

    plans.push({
      channels,
      eventId: event.id,
      fingerprint: event.fingerprint,
      priority: event.priority,
      score: event.score,
      sms: smsPlan,
      title: event.title,
      type: event.type,
    });
  }

  return {
    autoSmsEnabled,
    count: plans.length,
    quietHoursActive: quiet,
    queuedCount: queued.length,
    plans,
  };
};

module.exports = {
  buildSmsMessage,
  getEventChannels,
  isWithinQuietHours,
  nextQuietHoursEnd,
  planNotificationDeliveries,
};
