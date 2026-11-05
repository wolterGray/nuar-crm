const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createFatalErrorHandler,
  normalizeFatalError,
} = require('../services/processFailureService');

test('fatal process errors are normalized without losing existing stacks', () => {
  const existing = new Error('database socket closed');
  assert.equal(normalizeFatalError(existing), existing);
  assert.equal(normalizeFatalError('queue failed').message, 'queue failed');
  assert.match(normalizeFatalError({code: 'EPIPE'}).message, /EPIPE/);
});

test('fatal process errors request a non-zero graceful shutdown', () => {
  const calls = [];
  const logs = [];
  const handler = createFatalErrorHandler({
    logger: {error: (...args) => logs.push(args)},
    shutdown: (...args) => calls.push(args),
  });

  const error = handler('unhandledRejection', 'worker failed');
  assert.equal(error.message, 'worker failed');
  assert.deepEqual(calls, [['unhandledRejection', 1]]);
  assert.equal(logs.length, 1);
});

