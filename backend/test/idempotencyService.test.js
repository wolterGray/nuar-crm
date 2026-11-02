const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildReceiptKey,
  executeIdempotentMutation,
  getIdempotencyKey,
} = require('../services/idempotencyService');

test('validates idempotency keys', () => {
  assert.equal(getIdempotencyKey({ headers: {} }), null);
  assert.equal(getIdempotencyKey({ headers: { 'idempotency-key': 'sale-123456' } }), 'sale-123456');
  assert.throws(
    () => getIdempotencyKey({ headers: { 'idempotency-key': 'bad key' } }),
    /Invalid Idempotency-Key/,
  );
});

test('receipt keys are scoped by actor and operation', () => {
  const first = buildReceiptKey({ actorId: '1', key: 'same-key', operation: 'sale' });
  assert.notEqual(first, buildReceiptKey({ actorId: '2', key: 'same-key', operation: 'sale' }));
  assert.notEqual(first, buildReceiptKey({ actorId: '1', key: 'same-key', operation: 'payment' }));
});

test('replays a stored mutation response without running the mutation', async () => {
  const receipt = {
    payload: { response: { id: 42 } },
  };
  let mutationCalls = 0;
  const tx = {
    systemState: {
      findUnique: async () => receipt,
    },
  };
  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const outcome = await executeIdempotentMutation(
    prisma,
    { auth: { id: '7' }, headers: { 'idempotency-key': 'payment-123' } },
    'payment',
    async () => {
      mutationCalls += 1;
      return { id: 99 };
    },
  );

  assert.deepEqual(outcome, { replayed: true, result: { id: 42 } });
  assert.equal(mutationCalls, 0);
});

test('stores a new mutation response in the same transaction', async () => {
  const calls = [];
  const tx = {
    systemState: {
      create: async (args) => calls.push(['create', args]),
      findUnique: async () => null,
      update: async (args) => calls.push(['update', args]),
    },
  };
  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const outcome = await executeIdempotentMutation(
    prisma,
    { auth: { id: '7' }, headers: { 'idempotency-key': 'package-123' } },
    'package',
    async (transaction) => {
      assert.equal(transaction, tx);
      return { id: 11 };
    },
  );

  assert.deepEqual(outcome, { replayed: false, result: { id: 11 } });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1][1].data.payload.response, { id: 11 });
});
