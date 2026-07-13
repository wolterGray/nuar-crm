const crypto = require('crypto');

const DEFAULT_TARGET_STAMPS = 6;
const LOYALTY_SETTINGS_KEY = 'loyaltyProgramSettings';
const TOKEN_BYTES = 32;
const CARD_LANGUAGES = new Set(['ru', 'pl', 'en']);

const normalizeText = (value) => String(value ?? '').trim();

const normalizeCardLanguage = (value) => {
  const language = normalizeText(value).toLowerCase();
  return CARD_LANGUAGES.has(language) ? language : 'ru';
};

const hashPublicToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const generatePublicToken = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

const getPublicBaseUrl = () =>
  String(process.env.LOYALTY_PUBLIC_BASE_URL || process.env.PUBLIC_SITE_URL || 'https://nuarr.pl')
    .replace(/\/$/, '');

const buildPublicUrl = (token) => `${getPublicBaseUrl()}/club/${token}`;

const getActorUserId = (req) => {
  const id = Number(req?.auth?.id || req?.auth?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const validationError = (message, status = 422) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isOwner = (req) => {
  const role = String(req?.auth?.role ?? '');
  const adminEmail = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const authEmail = String(req?.auth?.email ?? '').trim().toLowerCase();
  return Boolean(
    role === 'owner' ||
    req?.auth?.id === 'local-admin' ||
    req?.auth?.sub === 'local-admin' ||
    (adminEmail && authEmail === adminEmail)
  );
};

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const getPayload = (record) =>
  record?.payload && typeof record.payload === 'object' ? record.payload : {};

const getDisplayName = (name) => {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || 'Gość NUAR';
  return `${parts[0]} ${parts[1][0]}.`;
};

const getCardTier = (card) => {
  const visits = Math.max(0, toInt(card?.lifetimeVisits ?? card?.stamps, 0));

  if (visits >= 50) return 'ROYAL';
  if (visits >= 20) return 'DIAMOND';
  if (visits >= 10) return 'GOLD';
  if (visits >= 3) return 'SILVER';
  return 'MEMBER';
};

const getVisualCardNumber = (card) => {
  const id = Math.max(0, toInt(card?.id, 0));
  const clientId = Math.max(0, toInt(card?.clientId, 0));
  const left = String(id || 1).padStart(4, '0').slice(-4);
  const middle = String((clientId * 37 + id * 11) % 10000).padStart(4, '0');
  const right = String((clientId * 91 + id * 17 + 9182) % 10000).padStart(4, '0');

  return `${left} • ${middle} • ${right}`;
};

const serializeTransaction = (transaction) => ({
  id: transaction.id,
  appointmentId: transaction.appointmentId,
  amount: transaction.amount,
  balanceAfter: transaction.balanceAfter,
  balanceBefore: transaction.balanceBefore,
  comment: transaction.description,
  createdAt: transaction.createdAt,
  createdBy: transaction.createdBy
    ? {
        id: transaction.createdBy.id,
        name: transaction.createdBy.name || transaction.createdBy.email || 'CRM',
      }
    : null,
  type: transaction.type,
});

const serializeCard = (card, publicToken = null) => {
  if (!card) return null;
  const latest = card.transactions?.[0] ?? null;
  const storedPublicToken = publicToken || card.publicToken || null;
  return {
    id: card.id,
    cardLanguage: normalizeCardLanguage(card.cardLanguage),
    clientId: card.clientId,
    createdAt: card.createdAt,
    archivedAt: card.archivedAt ?? null,
    archiveReason: card.archiveReason ?? null,
    cycleNumber: card.cycleNumber,
    isActive: card.isActive,
    lastTransactionAt: latest?.createdAt ?? null,
    lifetimeVisits: card.lifetimeVisits,
    publicUrl: storedPublicToken ? buildPublicUrl(storedPublicToken) : null,
    rewardAvailable: card.rewardAvailable,
    stamps: card.stamps,
    targetStamps: card.targetStamps,
    tier: getCardTier(card),
    updatedAt: card.updatedAt,
  };
};

const getProgramSettings = async (tx) => {
  const state = await tx.systemState.findUnique({
    where: { key: LOYALTY_SETTINGS_KEY },
  });
  const payload = getPayload(state);
  const targetStamps = Math.max(DEFAULT_TARGET_STAMPS, toInt(payload.targetStamps, DEFAULT_TARGET_STAMPS));
  return {
    bookingUrl: normalizeText(payload.bookingUrl) || 'https://nuarr.booksy.com/a',
    eligibleServiceIds: Array.isArray(payload.eligibleServiceIds)
      ? payload.eligibleServiceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [],
    targetStamps,
  };
};

const createUniqueTokenPayload = async (tx) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicToken = generatePublicToken();
    const publicTokenHash = hashPublicToken(publicToken);
    const existing = await tx.loyaltyCard.findUnique({
      where: { publicTokenHash },
      select: { id: true },
    });
    if (!existing) {
      return { publicToken, publicTokenHash };
    }
  }
  throw validationError('Could not create unique loyalty link', 500);
};

const findCardForClient = (tx, clientId) =>
  tx.loyaltyCard.findFirst({
    where: { clientId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

const createCardForClient = async (tx, clientId, { cardLanguage = 'ru' } = {}) => {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw validationError('Client not found', 404);
  }

  const existing = await findCardForClient(tx, clientId);
  if (existing) {
    throw validationError('Loyalty card already exists', 409);
  }

  const settings = await getProgramSettings(tx);
  const { publicToken, publicTokenHash } = await createUniqueTokenPayload(tx);
  const card = await tx.loyaltyCard.create({
    data: {
      clientId,
      cardLanguage: normalizeCardLanguage(cardLanguage),
      publicToken,
      publicTokenHash,
      targetStamps: settings.targetStamps,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return {
    card,
    publicToken,
    publicUrl: buildPublicUrl(publicToken),
  };
};

const applyTransaction = async (tx, {
  amount,
  appointmentId = null,
  cardId,
  createdById = null,
  description = '',
  type,
}) => {
  if (!Number.isInteger(amount) || amount === 0) {
    throw validationError('Transaction amount must be a non-zero integer');
  }

  const card = await tx.loyaltyCard.findUnique({
    where: { id: cardId },
  });
  if (!card) {
    throw validationError('Loyalty card not found', 404);
  }

  const balanceBefore = card.stamps;
  const balanceAfter = balanceBefore + amount;
  if (balanceAfter < 0) {
    throw validationError('Not enough loyalty stamps');
  }

  const targetStamps = Math.max(1, card.targetStamps || DEFAULT_TARGET_STAMPS);
  const lifetimeIncrement = type === 'EARN' && amount > 0 ? amount : 0;
  const lifetimeDecrement = type === 'REVERSAL' && amount < 0 ? Math.abs(amount) : 0;
  const transaction = await tx.loyaltyTransaction.create({
    data: {
      amount,
      appointmentId,
      balanceAfter,
      balanceBefore,
      createdById,
      description: normalizeText(description) || null,
      loyaltyCardId: card.id,
      type,
    },
  });

  const updatedCard = await tx.loyaltyCard.update({
    where: { id: card.id },
    data: {
      ...(lifetimeIncrement ? { lifetimeVisits: { increment: lifetimeIncrement } } : {}),
      ...(lifetimeDecrement ? { lifetimeVisits: { decrement: lifetimeDecrement } } : {}),
      rewardAvailable: balanceAfter >= targetStamps,
      stamps: balanceAfter,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return { card: updatedCard, transaction };
};

const redeemRewardAndReissue = async (tx, cardId, {
  createdById = null,
  description = 'Использование награды NUAR Club',
} = {}) => {
  const card = await tx.loyaltyCard.findUnique({
    where: { id: cardId },
  });
  if (!card) {
    throw validationError('Loyalty card not found', 404);
  }
  if (!card.isActive) {
    throw validationError('Only active loyalty cards can redeem rewards');
  }

  const targetStamps = Math.max(1, card.targetStamps || DEFAULT_TARGET_STAMPS);
  if (card.stamps < targetStamps || !card.rewardAvailable) {
    throw validationError('Not enough loyalty stamps');
  }

  const settings = await getProgramSettings(tx);
  const { publicToken, publicTokenHash } = await createUniqueTokenPayload(tx);
  const transaction = await tx.loyaltyTransaction.create({
    data: {
      amount: 0,
      balanceAfter: card.stamps,
      balanceBefore: card.stamps,
      createdById,
      description: normalizeText(description) || 'Использование награды NUAR Club',
      loyaltyCardId: card.id,
      type: 'REDEEM',
    },
  });
  const archivedCard = await tx.loyaltyCard.update({
    where: { id: card.id },
    data: {
      archivedAt: new Date(),
      archiveReason: 'reward_redeemed',
      isActive: false,
      rewardAvailable: false,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  const newCard = await tx.loyaltyCard.create({
    data: {
      cardLanguage: normalizeCardLanguage(card.cardLanguage),
      clientId: card.clientId,
      cycleNumber: Math.max(1, toInt(card.cycleNumber, 1)) + 1,
      lifetimeVisits: Math.max(0, toInt(card.lifetimeVisits, card.stamps)),
      publicToken,
      publicTokenHash,
      targetStamps: settings.targetStamps,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return {
    archivedCard,
    card: newCard,
    publicToken,
    publicUrl: buildPublicUrl(publicToken),
    transaction,
  };
};

const isRewardVisit = (payload) => {
  const values = [
    payload?.payment,
    payload?.source,
    payload?.service,
    payload?.serviceName,
    payload?.note,
  ].map((value) => normalizeText(value).toLowerCase());
  return values.some((value) =>
    /loyal|lojal|reward|nagrod|награ|бонус|free|gratis|бесплат/.test(value),
  );
};

const isPaidVisitPayload = (payload) => {
  if (isRewardVisit(payload)) return false;
  const paidAmount = Number(payload?.paidAmount);
  const amount = Number(payload?.amount);
  const finalPrice = Number(payload?.finalPrice);
  if (paidAmount > 0 || amount > 0 || finalPrice > 0) return true;
  return Boolean(
    payload?.packageUsageId ||
      Number(payload?.packageSessionsUsed) > 0 ||
      payload?.certificateUsageId ||
      Number(payload?.certificateAmountUsed) > 0,
  );
};

const isVisitEligibleForEarn = async (tx, visit) => {
  if (!visit?.clientId) return false;
  const payload = getPayload(visit);
  if (!isPaidVisitPayload(payload)) return false;
  const settings = await getProgramSettings(tx);
  if (settings.eligibleServiceIds.length === 0) return true;
  return visit.serviceId ? settings.eligibleServiceIds.includes(Number(visit.serviceId)) : false;
};

const earnForCompletedVisit = async (tx, visit, { createdById = null } = {}) => {
  if (!visit?.clientId || !(await isVisitEligibleForEarn(tx, visit))) {
    return { card: null, earned: false, reason: 'not_eligible', transaction: null };
  }

  const card = await findCardForClient(tx, visit.clientId);
  if (!card || !card.isActive) {
    return { card: null, earned: false, reason: 'no_active_card', transaction: null };
  }

  const existing = await tx.loyaltyTransaction.findFirst({
    where: {
      appointmentId: visit.id,
      type: 'EARN',
    },
  });
  if (existing) {
    return { card, earned: false, idempotent: true, reason: 'already_earned', transaction: existing };
  }

  const result = await applyTransaction(tx, {
    amount: 1,
    appointmentId: visit.id,
    cardId: card.id,
    createdById,
    description: 'Автоматическое начисление за завершённый оплаченный визит',
    type: 'EARN',
  });

  return { ...result, earned: true, reason: 'earned' };
};

const reverseEarnForVisit = async (tx, visit, { createdById = null, description = '' } = {}) => {
  if (!visit?.id) {
    return { reversed: false, reason: 'no_visit' };
  }

  const earn = await tx.loyaltyTransaction.findFirst({
    where: {
      appointmentId: visit.id,
      type: 'EARN',
    },
    include: { loyaltyCard: true },
  });
  if (!earn) {
    return { reversed: false, reason: 'no_earn' };
  }

  const existingReversal = await tx.loyaltyTransaction.findFirst({
    where: {
      appointmentId: visit.id,
      type: 'REVERSAL',
    },
  });
  if (existingReversal) {
    return { reversed: false, idempotent: true, reason: 'already_reversed' };
  }

  const result = await applyTransaction(tx, {
    amount: -Math.abs(earn.amount),
    appointmentId: visit.id,
    cardId: earn.loyaltyCardId,
    createdById,
    description: description || 'Откат начисления за отменённый завершённый визит',
    type: 'REVERSAL',
  });

  if (earn.loyaltyCard?.clientId) {
    await tx.loyaltyCard.updateMany({
      where: {
        clientId: earn.loyaltyCard.clientId,
        id: { not: earn.loyaltyCardId },
        isActive: true,
      },
      data: {
        lifetimeVisits: { decrement: Math.abs(earn.amount) },
      },
    });
  }

  return { ...result, reversed: true, reason: 'reversed' };
};

const getPublicCardByToken = async (tx, token) => {
  const publicToken = normalizeText(token);
  if (!publicToken) return null;
  const settings = await getProgramSettings(tx);
  const card = await tx.loyaltyCard.findUnique({
    where: { publicTokenHash: hashPublicToken(publicToken) },
    include: {
      client: { select: { name: true } },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!card || !card.isActive) {
    return null;
  }

  return {
    bookingUrl: settings.bookingUrl,
    cardLanguage: normalizeCardLanguage(card.cardLanguage),
    cardNumber: getVisualCardNumber(card),
    cardStatus: card.isActive ? 'active' : 'inactive',
    displayName: getDisplayName(card.client?.name),
    lastTransactionAt: card.transactions?.[0]?.createdAt ?? null,
    lifetimeVisits: card.lifetimeVisits,
    rewardAvailable: card.rewardAvailable,
    stamps: card.stamps,
    targetStamps: card.targetStamps,
    tier: getCardTier(card),
  };
};

module.exports = {
  applyTransaction,
  buildPublicUrl,
  createCardForClient,
  createUniqueTokenPayload,
  earnForCompletedVisit,
  findCardForClient,
  getActorUserId,
  getProgramSettings,
  getPublicCardByToken,
  hashPublicToken,
  isOwner,
  redeemRewardAndReissue,
  reverseEarnForVisit,
  serializeCard,
  serializeTransaction,
  validationError,
  __testing: {
    getCardTier,
    getDisplayName,
    getVisualCardNumber,
    hashPublicToken,
    isPaidVisitPayload,
    isRewardVisit,
    normalizeCardLanguage,
  },
};
