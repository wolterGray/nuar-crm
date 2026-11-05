const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');
const {
  createRequestMonitor,
  normalizeThreshold,
  requestPath,
} = require('../middleware/requestMonitor');

const runRequest = ({durationMs, statusCode = 200}) => {
  let elapsed = 0;
  const entries = [];
  const response = new EventEmitter();
  response.statusCode = statusCode;
  const monitor = createRequestMonitor({
    logger: {
      error: (...args) => entries.push(['error', ...args]),
      warn: (...args) => entries.push(['warn', ...args]),
    },
    now: () => elapsed,
    slowRequestMs: 1000,
  });
  const request = {
    method: 'POST',
    originalUrl: '/api/visits?clientId=secret',
    requestId: 'request-123',
  };
  let nextCalled = false;

  monitor(request, response, () => { nextCalled = true; });
  elapsed = durationMs;
  response.emit('finish');

  return {entries, nextCalled};
};

test('request monitor logs slow requests without query parameters', () => {
  const result = runRequest({durationMs: 1250});

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.entries, [[
    'warn',
    'Slow backend request:',
    {
      durationMs: 1250,
      method: 'POST',
      path: '/api/visits',
      requestId: 'request-123',
      status: 200,
    },
  ]]);
});

test('request monitor always logs server errors and stays quiet for healthy requests', () => {
  assert.equal(runRequest({durationMs: 10}).entries.length, 0);
  assert.equal(runRequest({durationMs: 10, statusCode: 503}).entries[0][0], 'error');
});

test('request monitor validates thresholds and strips query strings', () => {
  assert.equal(normalizeThreshold('3500'), 3500);
  assert.equal(normalizeThreshold('0'), 2000);
  assert.equal(normalizeThreshold('-1'), 2000);
  assert.equal(normalizeThreshold('invalid'), 2000);
  assert.equal(requestPath({originalUrl: '/ready?verbose=true'}), '/ready');
});
