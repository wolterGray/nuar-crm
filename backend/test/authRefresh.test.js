const assert = require('node:assert/strict');
const {before, beforeEach, test} = require('node:test');
const jwt = require('jsonwebtoken');
const {createAuthRouter} = require('../routes/auth');
const {verifyJwt, invalidateUserCache} = require('../middleware/auth');
const {authLoginLimiter} = require('../middleware/rateLimiter');
const {hashPassword} = require('../utils/passwordAuth');

const JWT_SECRET = 'test-secret-for-refresh-session-tests-32-chars';

before(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  authLoginLimiter.reset();
  invalidateUserCache();
});

const createResponse = (resolve) => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    resolve?.({statusCode: this.statusCode, body: payload});
    return this;
  },
});

const invokeRouter = (router, {method, url, body = {}, headers = {}}) =>
  new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: `/api/auth${url}`,
      body,
      headers,
      params: {},
      ip: '127.0.0.1',
    };
    const res = createResponse(resolve);
    router.handle(req, res, (error) => {
      if (error) reject(error);
      else resolve({statusCode: res.statusCode, body: res.body});
    });
  });

const createPrisma = (user) => ({
  user: {
    count: async () => (user.role === 'owner' && user.isActive ? 1 : 0),
    findUnique: async ({where}) => {
      if (where.id !== undefined) return Number(where.id) === user.id ? user : null;
      if (where.email !== undefined) return where.email === user.email ? user : null;
      return null;
    },
    update: async ({data}) => Object.assign(user, data),
  },
  auditLog: {create: async ({data}) => data},
  errorEvent: {create: async ({data}) => data},
});

test('auth refresh: login issues a refresh token and refresh rotates the session', async () => {
  const user = {
    id: 7,
    email: 'owner@nuarr.pl',
    name: 'Owner',
    role: 'owner',
    isActive: true,
    employeeId: null,
    permissions: {},
    passwordChangedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    passwordHash: await hashPassword('StrongPassword#2026'),
  };
  const router = createAuthRouter({prismaClient: createPrisma(user)});

  const login = await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {email: user.email, password: 'StrongPassword#2026'},
  });
  assert.equal(login.statusCode, 200);
  assert.ok(login.body.token);
  assert.ok(login.body.refreshToken);
  assert.equal(jwt.verify(login.body.refreshToken, JWT_SECRET).tokenType, 'refresh');

  const refreshed = await invokeRouter(router, {
    method: 'POST',
    url: '/refresh',
    body: {refreshToken: login.body.refreshToken},
  });
  assert.equal(refreshed.statusCode, 200);
  assert.ok(refreshed.body.token);
  assert.ok(refreshed.body.refreshToken);
  assert.equal(refreshed.body.user.id, String(user.id));
  assert.equal(jwt.verify(refreshed.body.token, JWT_SECRET).tokenType, undefined);
});

test('auth refresh: refresh token is rejected as an API access token', async () => {
  const refreshToken = jwt.sign(
    {tokenType: 'refresh', role: 'owner'},
    JWT_SECRET,
    {subject: '7', expiresIn: '90d'},
  );
  const req = {headers: {authorization: `Bearer ${refreshToken}`}};
  const result = await new Promise((resolve) => {
    const res = createResponse((response) => resolve({...response, nextCalled: false}));
    verifyJwt(req, res, () => resolve({statusCode: 200, nextCalled: true}));
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 401);
  assert.match(result.body.error, /Refresh token cannot access/);
});
