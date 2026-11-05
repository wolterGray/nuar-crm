const assert = require('node:assert/strict');
const test = require('node:test');
const {createErrorHandler} = require('../middleware/errorHandler');

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

test('error middleware responds before deferred database logging completes', async () => {
  let resolveLogging;
  const logging = new Promise((resolve) => { resolveLogging = resolve; });
  const calls = [];
  const response = {
    json(payload) { calls.push(['json', payload]); return this; },
    status(code) { calls.push(['status', code]); return this; },
  };
  const handler = createErrorHandler({
    logErrorEvent: () => logging,
    logger: {error: () => {}},
    prismaClient: {},
  });

  handler(new Error('database unavailable'), {
    body: {password: 'must be redacted downstream'},
    method: 'POST',
    originalUrl: '/api/visits',
    params: {},
    query: {},
  }, response);

  assert.deepEqual(calls, [
    ['status', 500],
    ['json', {success: false, error: 'Internal Server Error'}],
  ]);
  resolveLogging();
  await flushMicrotasks();
});

test('error middleware contains deferred logging failures', async () => {
  const logged = [];
  const handler = createErrorHandler({
    logErrorEvent: async () => { throw new Error('logging failed'); },
    logger: {error: (...args) => logged.push(args)},
    prismaClient: {},
  });
  const response = {json: () => response, status: () => response};

  handler(Object.assign(new Error('invalid'), {status: 422}), {
    body: {}, method: 'POST', originalUrl: '/api/test', params: {}, query: {},
  }, response);
  await flushMicrotasks();

  assert.equal(logged.some((entry) => entry[0] === 'Deferred ErrorEvent logging failed:'), true);
});
