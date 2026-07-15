const crypto = require('crypto');

const DEFAULT_TARGET_STAMPS = 6;
const LOYALTY_SETTINGS_KEY = 'loyaltyProgramSettings';
const TOKEN_BYTES = 32;
const PUBLIC_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PUBLIC_CODE_LENGTH = 8;
const PUBLIC_CODE_PATTERN = /^[A-Z0-9]{8}$/;
const CARD_LANGUAGES = new Set(['ru', 'pl', 'en']);

const normalizeText = (value) => String(value ?? '').trim();

const normalizeCardLanguage = (value) => {
  const language = normalizeText(value).toLowerCase();
  return CARD_LANGUAGES.has(language) ? language : 'ru';
};

const hashPublicToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const generatePublicToken = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');

const generatePublicCode = () => {
  let code = '';
  for (let index = 0; index < PUBLIC_CODE_LENGTH; index += 1) {
    code += PUBLIC_CODE_ALPHABET[crypto.randomInt(PUBLIC_CODE_ALPHABET.length)];
  }
  return code;
};

const normalizePublicCode = (value) => {
  const code = normalizeText(value).toUpperCase();
  return PUBLIC_CODE_PATTERN.test(code) ? code : null;
};

const getPublicBaseUrl = () =>
  String(process.env.LOYALTY_PUBLIC_BASE_URL || process.env.PUBLIC_SITE_URL || 'https://nuarr.pl')
    .replace(/\/$/, '');

const buildPublicUrl = (identifier) => `${getPublicBaseUrl()}/club/${identifier}`;

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

const normalizeTier = (value) => {
  const tier = normalizeText(value).toUpperCase();
  if (tier === 'ROYALTY') return 'ROYAL';
  return ['MEMBER', 'SILVER', 'GOLD', 'DIAMOND', 'ROYAL'].includes(tier) ? tier : 'MEMBER';
};

const normalizeStatus = (value) => normalizeText(value).toLowerCase();

const isActiveVisitStatus = (visit) => {
  const payload = getPayload(visit);
  const values = [visit?.recordType, payload?.status, payload?.visitStatus, payload?.kind]
    .map((value) => normalizeStatus(value));
  return !values.some((value) => ['cancelled', 'canceled', 'no_show', 'deleted', 'blocked'].includes(value));
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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

const serializeChest = (chest) => ({
  id: chest.id,
  createdAt: chest.createdAt,
  openedAt: chest.openedAt,
  reward: chest.reward ? serializeReward(chest.reward) : null,
  status: normalizeStatus(chest.status) || 'available',
  tier: normalizeTier(chest.tier),
  visitNumber: chest.visitNumber ?? null,
});

const serializeReward = (reward) => ({
  id: reward.id,
  createdAt: reward.createdAt,
  description: reward.snapshotDescription,
  durationMin: reward.snapshotDurationMin,
  expiresAt: reward.expiresAt,
  name: reward.snapshotName,
  redeemedAt: reward.redeemedAt,
  requiresOwnerApproval: Boolean(reward.requiresOwnerApproval),
  status: normalizeStatus(reward.status) || 'available',
  tier: normalizeTier(reward.snapshotTier),
  type: reward.snapshotType,
  value: reward.snapshotValue === null || reward.snapshotValue === undefined
    ? null
    : Number(reward.snapshotValue),
});

const serializeRewardTemplate = (template) => ({
  id: template.id,
  active: Boolean(template.active),
  description: template.description,
  durationMin: template.durationMin,
  expiresAfterDays: template.expiresAfterDays,
  name: template.name,
  requiresOwnerApproval: Boolean(template.requiresOwnerApproval),
  rewardType: template.rewardType,
  tier: normalizeTier(template.tier),
  value: template.value === null || template.value === undefined ? null : Number(template.value),
  weight: template.weight,
});

const serializeUpcomingVisit = (visit) => {
  if (!visit) return null;
  const payload = getPayload(visit);
  return {
    id: visit.id,
    date: payload.inputDate || payload.date || null,
    durationMin: Number(payload.durationMin || payload.duration || visit.service?.durationMin || 0) || null,
    employeeName: visit.employee?.name || payload.masterName || payload.employeeName || null,
    serviceName: visit.service?.name || payload.serviceName || payload.service || null,
    scheduledAt: visit.scheduledAt,
    time: payload.time || null,
  };
};

const serializeCard = (card, publicToken = null) => {
  if (!card) return null;
  const latest = card.transactions?.[0] ?? null;
  const storedPublicIdentifier = card.publicCode || publicToken || card.publicToken || null;
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
    publicCode: card.publicCode,
    publicUrl: storedPublicIdentifier ? buildPublicUrl(storedPublicIdentifier) : null,
    rewardAvailable: card.rewardAvailable,
    chestCounts: card.chests ? {
      available: card.chests.filter((chest) => normalizeStatus(chest.status) === 'available').length,
      opened: card.chests.filter((chest) => normalizeStatus(chest.status) === 'opened').length,
      total: card.chests.length,
    } : undefined,
    rewardCounts: card.client?.loyaltyRewards ? {
      available: card.client.loyaltyRewards.filter((reward) => normalizeStatus(reward.status) === 'available').length,
      redeemed: card.client.loyaltyRewards.filter((reward) => normalizeStatus(reward.status) === 'redeemed').length,
      total: card.client.loyaltyRewards.length,
    } : undefined,
    stamps: card.stamps,
    targetStamps: card.targetStamps,
    tier: getCardTier(card),
    updatedAt: card.updatedAt,
  };
};

const getUpcomingVisitForClient = async (tx, clientId) => {
  const visits = await tx.visit.findMany({
    where: {
      clientId,
      scheduledAt: { gte: new Date() },
    },
    include: {
      employee: { select: { name: true } },
      service: { select: { durationMin: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  });
  return visits.find(isActiveVisitStatus) || null;
};

const getClubCollectionsForClient = async (tx, clientId) => {
  const [chests, rewards, upcomingVisit] = await Promise.all([
    tx.loyaltyChest.findMany({
      where: { clientId },
      include: { reward: true },
      orderBy: { createdAt: 'desc' },
    }),
    tx.loyaltyReward.findMany({
      where: { clientId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    getUpcomingVisitForClient(tx, clientId),
  ]);

  return {
    chests: chests.map(serializeChest),
    rewards: rewards.map(serializeReward),
    upcomingVisit: serializeUpcomingVisit(upcomingVisit),
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

const createUniquePublicCode = async (tx) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const publicCode = generatePublicCode();
    const existing = await tx.loyaltyCard.findUnique({
      where: { publicCode },
      select: { id: true },
    });
    if (!existing) {
      return publicCode;
    }
  }
  throw validationError('Could not create unique public loyalty code', 500);
};

const findCardForClient = (tx, clientId) =>
  tx.loyaltyCard.findFirst({
    where: { clientId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      chests: true,
      client: {
        include: {
          loyaltyRewards: true,
        },
      },
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
  const publicCode = await createUniquePublicCode(tx);
  const card = await tx.loyaltyCard.create({
    data: {
      clientId,
      cardLanguage: normalizeCardLanguage(cardLanguage),
      publicCode,
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
    publicCode,
    publicToken,
    publicUrl: buildPublicUrl(publicCode),
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

  const targetStamps = Math.max(1, card.targetStamps || DEFAULT_TARGET_STAMPS);
  const balanceBefore = card.stamps;
  const previousLifetime = Math.max(0, toInt(card.lifetimeVisits, 0));
  const lifetimeIncrement = type === 'EARN' && amount > 0 ? amount : 0;
  const lifetimeDecrement = type === 'REVERSAL' && amount < 0 ? Math.abs(amount) : 0;
  const nextLifetime = Math.max(0, previousLifetime + lifetimeIncrement - lifetimeDecrement);
  let balanceAfter = balanceBefore + amount;

  if (lifetimeIncrement) {
    balanceAfter = nextLifetime % targetStamps;
  } else if (lifetimeDecrement && balanceAfter < 0) {
    balanceAfter = Math.max(0, nextLifetime % targetStamps);
  }

  if (balanceAfter < 0) {
    throw validationError('Not enough loyalty stamps');
  }

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

  const chestCreates = [];
  if (lifetimeIncrement) {
    for (let visitNumber = previousLifetime + 1; visitNumber <= nextLifetime; visitNumber += 1) {
      if (visitNumber > 0 && visitNumber % targetStamps === 0) {
        chestCreates.push(
          tx.loyaltyChest.upsert({
            where: {
              loyaltyCardId_visitNumber: {
                loyaltyCardId: card.id,
                visitNumber,
              },
            },
            update: {},
            create: {
              clientId: card.clientId,
              loyaltyCardId: card.id,
              tier: getCardTier({ lifetimeVisits: visitNumber }),
              visitNumber,
            },
          }),
        );
      }
    }
  }

  if (chestCreates.length) {
    await Promise.all(chestCreates);
  }

  const availableClubItems = await Promise.all([
    tx.loyaltyChest.count({
      where: {
        clientId: card.clientId,
        status: 'available',
      },
    }),
    tx.loyaltyReward.count({
      where: {
        clientId: card.clientId,
        status: 'available',
      },
    }),
  ]);

  const updatedCard = await tx.loyaltyCard.update({
    where: { id: card.id },
    data: {
      ...(lifetimeIncrement ? { lifetimeVisits: { increment: lifetimeIncrement } } : {}),
      ...(lifetimeDecrement ? { lifetimeVisits: { decrement: lifetimeDecrement } } : {}),
      rewardAvailable: availableClubItems.some((count) => count > 0),
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

  if (!card.rewardAvailable) {
    throw validationError('Not enough loyalty stamps');
  }

  const settings = await getProgramSettings(tx);
  const { publicToken, publicTokenHash } = await createUniqueTokenPayload(tx);
  const publicCode = await createUniquePublicCode(tx);
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
      publicCode,
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
    publicCode,
    publicToken,
    publicUrl: buildPublicUrl(publicCode),
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

const defaultRewardForTier = (tier) => ({
  active: true,
  description: 'Подарок NUAR Club',
  durationMin: null,
  expiresAfterDays: 60,
  id: null,
  name: tier === 'ROYAL'
    ? 'Royal подарок NUAR'
    : tier === 'DIAMOND'
      ? 'Diamond подарок NUAR'
      : 'Подарок NUAR Club',
  requiresOwnerApproval: false,
  rewardType: 'gift',
  tier,
  value: null,
  weight: 1,
});

const chooseWeightedTemplate = (templates) => {
  const prepared = templates
    .map((template) => ({ ...template, weight: Math.max(1, toInt(template.weight, 1)) }));
  const total = prepared.reduce((sum, template) => sum + template.weight, 0);
  let cursor = Math.floor(Math.random() * total);
  for (const template of prepared) {
    cursor -= template.weight;
    if (cursor < 0) return template;
  }
  return prepared[0] || null;
};

const openChest = async (tx, chestId, { clientId = null } = {}) => {
  const chest = await tx.loyaltyChest.findUnique({
    where: { id: chestId },
    include: { reward: true },
  });
  if (!chest) {
    throw validationError('Chest not found', 404);
  }
  if (clientId && chest.clientId !== clientId) {
    throw validationError('Chest not found', 404);
  }
  if (normalizeStatus(chest.status) === 'opened' && chest.reward) {
    return { chest, reward: chest.reward, idempotent: true };
  }

  const tier = normalizeTier(chest.tier);
  const templates = await tx.loyaltyRewardTemplate.findMany({
    where: { active: true, tier },
    orderBy: [{ weight: 'desc' }, { updatedAt: 'desc' }],
  });
  const template = chooseWeightedTemplate(templates) || defaultRewardForTier(tier);
  const expiresAfterDays = toInt(template.expiresAfterDays, 0);
  const expiresAt = expiresAfterDays > 0 ? addDays(new Date(), expiresAfterDays) : null;

  const reward = await tx.loyaltyReward.upsert({
    where: { sourceChestId: chest.id },
    update: {},
    create: {
      clientId: chest.clientId,
      expiresAt,
      requiresOwnerApproval: Boolean(template.requiresOwnerApproval),
      snapshotDescription: normalizeText(template.description) || null,
      snapshotDurationMin: template.durationMin ?? null,
      snapshotName: normalizeText(template.name) || 'Подарок NUAR Club',
      snapshotTier: tier,
      snapshotType: normalizeText(template.rewardType) || 'gift',
      snapshotValue: template.value ?? null,
      sourceChestId: chest.id,
      templateId: template.id || null,
    },
  });

  const openedChest = await tx.loyaltyChest.update({
    where: { id: chest.id },
    data: {
      openedAt: chest.openedAt || new Date(),
      status: 'opened',
    },
    include: { reward: true },
  });

  return { chest: openedChest, reward };
};

const redeemIssuedReward = async (tx, rewardId, {
  createdById = null,
  isOwnerActor = false,
  visitId = null,
} = {}) => {
  const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId } });
  if (!reward) {
    throw validationError('Reward not found', 404);
  }
  if (normalizeStatus(reward.status) !== 'available') {
    throw validationError('Reward is not available');
  }
  if (reward.expiresAt && reward.expiresAt < new Date()) {
    await tx.loyaltyReward.update({
      where: { id: reward.id },
      data: { status: 'expired' },
    });
    throw validationError('Reward expired');
  }
  if (reward.requiresOwnerApproval && !isOwnerActor) {
    throw validationError('Owner approval required', 403);
  }

  const updatedReward = await tx.loyaltyReward.update({
    where: { id: reward.id },
    data: {
      redeemedAt: new Date(),
      redeemedById: createdById,
      status: 'redeemed',
      visitId,
    },
  });
  const [availableChests, availableRewards] = await Promise.all([
    tx.loyaltyChest.count({ where: { clientId: reward.clientId, status: 'available' } }),
    tx.loyaltyReward.count({ where: { clientId: reward.clientId, status: 'available' } }),
  ]);
  await tx.loyaltyCard.updateMany({
    where: { clientId: reward.clientId, isActive: true },
    data: { rewardAvailable: availableChests + availableRewards > 0 },
  });
  return updatedReward;
};

const listRewardTemplates = async (tx) => {
  const templates = await tx.loyaltyRewardTemplate.findMany({
    orderBy: [{ tier: 'asc' }, { active: 'desc' }, { weight: 'desc' }, { updatedAt: 'desc' }],
  });
  return templates.map(serializeRewardTemplate);
};

const saveRewardTemplate = async (tx, data, id = null) => {
  const name = normalizeText(data?.name);
  if (!name) throw validationError('Reward name is required');
  const payload = {
    active: data?.active === undefined ? true : Boolean(data.active),
    description: normalizeText(data?.description) || null,
    durationMin: data?.durationMin ? Math.max(0, toInt(data.durationMin, 0)) : null,
    expiresAfterDays: data?.expiresAfterDays ? Math.max(0, toInt(data.expiresAfterDays, 0)) : null,
    name,
    requiresOwnerApproval: Boolean(data?.requiresOwnerApproval),
    rewardType: normalizeText(data?.rewardType) || 'gift',
    tier: normalizeTier(data?.tier),
    value: data?.value === undefined || data?.value === '' || data?.value === null ? null : Number(data.value),
    weight: Math.max(1, toInt(data?.weight, 1)),
  };

  const template = id
    ? await tx.loyaltyRewardTemplate.update({ where: { id }, data: payload })
    : await tx.loyaltyRewardTemplate.create({ data: payload });
  return serializeRewardTemplate(template);
};

const findCardByPublicIdentifier = async (tx, identifier, query = {}) => {
  const value = normalizeText(identifier);
  if (!value) return null;

  const publicCode = normalizePublicCode(value);
  if (publicCode) {
    const card = await tx.loyaltyCard.findUnique({
      ...query,
      where: { publicCode },
    });
    if (card) return card;
  }

  return tx.loyaltyCard.findUnique({
    ...query,
    where: { publicTokenHash: hashPublicToken(value) },
  });
};

const getPublicCardByToken = async (tx, token) => {
  const publicIdentifier = normalizeText(token);
  if (!publicIdentifier) return null;
  const settings = await getProgramSettings(tx);
  const card = await findCardByPublicIdentifier(tx, publicIdentifier, {
    include: {
      client: { select: { id: true, name: true } },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!card || !card.isActive) {
    return null;
  }

  const collections = await getClubCollectionsForClient(tx, card.clientId);

  return {
    bookingUrl: settings.bookingUrl,
    cardLanguage: normalizeCardLanguage(card.cardLanguage),
    cardNumber: getVisualCardNumber(card),
    cardStatus: card.isActive ? 'active' : 'inactive',
    chests: collections.chests,
    displayName: getDisplayName(card.client?.name),
    lastTransactionAt: card.transactions?.[0]?.createdAt ?? null,
    lifetimeVisits: card.lifetimeVisits,
    publicCode: card.publicCode,
    publicUrl: card.publicCode ? buildPublicUrl(card.publicCode) : null,
    rewardAvailable: card.rewardAvailable,
    rewards: collections.rewards,
    stamps: card.stamps,
    targetStamps: card.targetStamps,
    tier: getCardTier(card),
    upcomingVisit: collections.upcomingVisit,
  };
};

module.exports = {
  applyTransaction,
  buildPublicUrl,
  createCardForClient,
  createUniquePublicCode,
  createUniqueTokenPayload,
  earnForCompletedVisit,
  findCardByPublicIdentifier,
  findCardForClient,
  getClubCollectionsForClient,
  getActorUserId,
  getProgramSettings,
  getPublicCardByToken,
  hashPublicToken,
  isOwner,
  listRewardTemplates,
  openChest,
  redeemRewardAndReissue,
  redeemIssuedReward,
  reverseEarnForVisit,
  saveRewardTemplate,
  serializeCard,
  serializeChest,
  serializeReward,
  serializeRewardTemplate,
  serializeTransaction,
  validationError,
  __testing: {
    getCardTier,
    getDisplayName,
    getVisualCardNumber,
    generatePublicCode,
    hashPublicToken,
    isPaidVisitPayload,
    isRewardVisit,
    normalizeCardLanguage,
    normalizePublicCode,
  },
};
