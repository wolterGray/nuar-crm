const assert = require('node:assert/strict');
const test = require('node:test');

const { getExpectedUpdatedAt, updateWithVersion } = require('../domain/optimisticConcurrency');

test('reads a valid expected record version', () => {
  const value = getExpectedUpdatedAt({ updatedAt: '2026-11-02T10:00:00.000Z' });
  assert.equal(value.toISOString(), '2026-11-02T10:00:00.000Z');
  assert.equal(getExpectedUpdatedAt({ updatedAt: 'invalid' }), null);
});

test('updates a versioned record only when updatedAt still matches', async () => {
  const calls = [];
  const model = {
    findUnique: async ({ where }) => ({ id: where.id, name: 'saved' }),
    updateMany: async (args) => {
      calls.push(args);
      return { count: 1 };
    },
  };
  const result = await updateWithVersion(model, {
    data: { name: 'saved' },
    id: 4,
    payload: { updatedAt: '2026-11-02T10:00:00.000Z' },
  });
  assert.equal(result.id, 4);
  assert.equal(calls[0].where.updatedAt.toISOString(), '2026-11-02T10:00:00.000Z');
});

test('rejects a stale update with HTTP 409 semantics', async () => {
  const model = { updateMany: async () => ({ count: 0 }) };
  await assert.rejects(
    updateWithVersion(model, {
      data: {},
      id: 4,
      payload: { expectedUpdatedAt: '2026-11-02T10:00:00.000Z' },
    }),
    (error) => error.status === 409 && error.code === 'STALE_WRITE',
  );
});

test('keeps backward compatibility when a client sends no version', async () => {
  const model = { update: async ({ where }) => ({ id: where.id }) };
  assert.deepEqual(await updateWithVersion(model, { data: {}, id: 7, payload: {} }), { id: 7 });
});
