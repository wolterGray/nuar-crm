const assert = require('node:assert/strict');
const {test} = require('node:test');
const jwt = require('jsonwebtoken');
const {requireOwner, verifyJwt} = require('../middleware/auth');

const createResponse = () => ({
  body: null,
  statusCode: 200,
  json(body) {
    this.body = body;
    return this;
  },
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
});

test('JWT middleware rejects an unauthenticated Push API request', () => {
  const response = createResponse();
  let nextCalled = false;
  verifyJwt({headers: {}}, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('JWT middleware accepts a valid authenticated request', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
  const token = jwt.sign({email: 'user@example.com', role: 'admin', sub: '42'}, process.env.JWT_SECRET);
  const request = {headers: {authorization: `Bearer ${token}`}};
  const response = createResponse();
  let nextCalled = false;

  verifyJwt(request, response, () => {
    nextCalled = true;
  });

  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  assert.equal(nextCalled, true);
  assert.equal(request.auth.sub, '42');
});

test('owner guard still rejects non-owner administration requests', () => {
  const response = createResponse();
  let nextCalled = false;
  requireOwner({auth: {role: 'admin'}}, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});
