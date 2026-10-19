const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createRateLimiter, cleanIp} = require('../middleware/rateLimiter');

const createMockReqRes = (ip = '192.168.1.10', headers = {}) => {
  const req = {
    headers: {...headers},
    ip,
    socket: {remoteAddress: ip},
  };

  const resHeaders = {};
  let statusCode = 200;
  let jsonBody = null;

  const res = {
    getHeader: (name) => resHeaders[name.toLowerCase()],
    json: (body) => { jsonBody = body; return res; },
    setHeader: (name, val) => { resHeaders[name.toLowerCase()] = val; },
    status: (code) => { statusCode = code; return res; },
  };

  return {jsonBody: () => jsonBody, req, res, resHeaders, statusCode: () => statusCode};
};

test('cleanIp correctly parses x-forwarded-for or socket ip', () => {
  assert.equal(cleanIp({headers: {'x-forwarded-for': '203.0.113.195, 70.41.3.18'}}), '203.0.113.195');
  assert.equal(cleanIp({headers: {}, ip: '10.0.0.5'}), '10.0.0.5');
  assert.equal(cleanIp({headers: {}, socket: {remoteAddress: '127.0.0.1'}}), '127.0.0.1');
});

test('rateLimiter allows requests up to max and blocks excess with 429', () => {
  const limiter = createRateLimiter({
    max: 3,
    message: 'Rate limit exceeded',
    windowMs: 60 * 1000,
  });

  let nextCalled = 0;
  const next = () => { nextCalled += 1; };

  // Request 1
  const call1 = createMockReqRes('1.2.3.4');
  limiter(call1.req, call1.res, next);
  assert.equal(nextCalled, 1);
  assert.equal(call1.resHeaders['ratelimit-remaining'], 2);

  // Request 2
  const call2 = createMockReqRes('1.2.3.4');
  limiter(call2.req, call2.res, next);
  assert.equal(nextCalled, 2);
  assert.equal(call2.resHeaders['ratelimit-remaining'], 1);

  // Request 3
  const call3 = createMockReqRes('1.2.3.4');
  limiter(call3.req, call3.res, next);
  assert.equal(nextCalled, 3);
  assert.equal(call3.resHeaders['ratelimit-remaining'], 0);

  // Request 4: Blocked!
  const call4 = createMockReqRes('1.2.3.4');
  limiter(call4.req, call4.res, next);
  assert.equal(nextCalled, 3); // next was NOT called
  assert.equal(call4.statusCode(), 429);
  assert.equal(call4.jsonBody().error, 'Rate limit exceeded');
  assert.ok(call4.resHeaders['retry-after'] > 0);

  // Different IP should still be allowed
  const callOther = createMockReqRes('5.6.7.8');
  limiter(callOther.req, callOther.res, next);
  assert.equal(nextCalled, 4);
});

test('rateLimiter resets correctly after window expires or via .reset()', () => {
  const limiter = createRateLimiter({max: 1, windowMs: 1000});

  let nextCalled = 0;
  const next = () => { nextCalled += 1; };

  const c1 = createMockReqRes('10.10.10.10');
  limiter(c1.req, c1.res, next);
  assert.equal(nextCalled, 1);

  const c2 = createMockReqRes('10.10.10.10');
  limiter(c2.req, c2.res, next);
  assert.equal(c2.statusCode(), 429);

  // Manual reset
  limiter.reset();

  const c3 = createMockReqRes('10.10.10.10');
  limiter(c3.req, c3.res, next);
  assert.equal(nextCalled, 2);
  assert.equal(c3.statusCode(), 200);
});
