const crypto = require('crypto');

const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;
const VALID_KEY = /^[A-Za-z0-9._:-]+$/;

const toJsonValue = (value) => JSON.parse(JSON.stringify(value));

const getActorId = (req) =>
  String(req?.auth?.id || req?.auth?.sub || req?.auth?.email || 'anonymous');

const getIdempotencyKey = (req) => {
  const value = String(req?.headers?.[IDEMPOTENCY_HEADER] || '').trim();
  if (!value) return null;
  if (value.length < 8 || value.length > MAX_KEY_LENGTH || !VALID_KEY.test(value)) {
    const error = new Error('Invalid Idempotency-Key header');
    error.status = 400;
    throw error;
  }
  return value;
};

const buildReceiptKey = ({ actorId, key, operation }) => {
  const digest = crypto
    .createHash('sha256')
    .update(`${operation}\n${actorId}\n${key}`)
    .digest('hex');
  return `idempotency:${digest}`;
};

async function executeIdempotentMutation(prisma, req, operation, mutation) {
  const key = getIdempotencyKey(req);
  if (!key) {
    return {
      replayed: false,
      result: await prisma.$transaction((tx) => mutation(tx)),
    };
  }

  const receiptKey = buildReceiptKey({
    actorId: getActorId(req),
    key,
    operation,
  });

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.systemState.findUnique({ where: { key: receiptKey } });
      if (existing) return { replayed: true, result: existing.payload?.response };

      await tx.systemState.create({
        data: {
          key: receiptKey,
          payload: { operation },
        },
      });

      const mutationResult = await mutation(tx);
      const response = toJsonValue(mutationResult);
      await tx.systemState.update({
        where: { key: receiptKey },
        data: {
          payload: {
            operation,
            response,
          },
        },
      });
      return { replayed: false, result: response };
    });

    return outcome;
  } catch (error) {
    if (error?.code !== 'P2002') throw error;

    const receipt = await prisma.systemState.findUnique({ where: { key: receiptKey } });
    if (!receipt?.payload || !Object.prototype.hasOwnProperty.call(receipt.payload, 'response')) {
      throw error;
    }
    return { replayed: true, result: receipt.payload.response };
  }
}

module.exports = {
  buildReceiptKey,
  executeIdempotentMutation,
  getIdempotencyKey,
};
