const assert = require('node:assert/strict');
const test = require('node:test');
const {createRequestContext, getRequestId} = require('../middleware/requestContext');

test('request context preserves a safe upstream request id', () => {
  assert.equal(getRequestId('edge-123:abc', () => 'generated'), 'edge-123:abc');
});

test('request context replaces malformed or oversized request ids', () => {
  assert.equal(getRequestId('contains spaces', () => 'generated'), 'generated');
  assert.equal(getRequestId('x'.repeat(129), () => 'generated'), 'generated');
});

test('request context exposes one correlation id on request and response', () => {
  const responseHeaders = {};
  const req = {get: () => undefined};
  const res = {set: (name, value) => { responseHeaders[name] = value; }};
  let nextCalled = false;
  const middleware = createRequestContext({createId: () => 'server-generated-id'});

  middleware(req, res, () => { nextCalled = true; });

  assert.equal(req.requestId, 'server-generated-id');
  assert.equal(responseHeaders['X-Request-Id'], 'server-generated-id');
  assert.equal(nextCalled, true);
});
