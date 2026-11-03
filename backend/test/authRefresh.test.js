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

const createPrisma = (user) => {
  const sessions = new Map();
  return ({
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
  authSession: {
    create: async ({data}) => { sessions.set(data.id, {...data}); return data; },
    findMany: async ({where}) => Array.from(sessions.values())
      .filter((session) => session.userId === where.userId && !session.revokedAt && session.expiresAt > new Date())
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt),
    findFirst: async ({where}) => {
      const session = sessions.get(where.id);
      return session && session.userId === where.userId && !session.revokedAt && session.expiresAt > new Date()
        ? session
        : null;
    },
    update: async ({where, data}) => {
      const updated = {...sessions.get(where.id), ...data};
      sessions.set(where.id, updated);
      return updated;
    },
    updateMany: async ({where, data}) => {
      let count = 0;
      for (const [id, session] of sessions.entries()) {
        const idMatches = typeof where.id === 'string'
          ? id === where.id
          : where.id?.not
            ? id !== where.id.not
            : true;
        if (session.userId !== where.userId || session.revokedAt || !idMatches) continue;
        sessions.set(id, {...session, ...data});
        count += 1;
      }
      return {count};
    },
  },
  });
};

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
  assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);
  assert.equal(refreshed.body.user.id, String(user.id));
  assert.equal(jwt.verify(refreshed.body.token, JWT_SECRET).tokenType, undefined);

  const reused = await invokeRouter(router, {
    method: 'POST',
    url: '/refresh',
    body: {refreshToken: login.body.refreshToken},
  });
  assert.equal(reused.statusCode, 401);
  assert.match(reused.body.error, /reused refresh token/i);
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

test('auth sessions: lists devices and revokes every session except the current one', async () => {
  const user = {
    id: 8,
    email: 'devices@nuarr.pl',
    name: 'Devices Owner',
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
  const first = await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {email: user.email, password: 'StrongPassword#2026'},
    headers: {'user-agent': 'Mozilla/5.0 (Macintosh)'},
  });
  const second = await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {email: user.email, password: 'StrongPassword#2026'},
    headers: {'user-agent': 'Mozilla/5.0 (iPhone)'},
  });

  const before = await invokeRouter(router, {
    method: 'GET',
    url: '/sessions',
    headers: {authorization: `Bearer ${second.body.token}`},
  });
  assert.equal(before.statusCode, 200);
  assert.equal(before.body.sessions.length, 2);
  assert.equal(before.body.sessions.filter((session) => session.current).length, 1);

  const revoked = await invokeRouter(router, {
    method: 'POST',
    url: '/sessions/revoke-others',
    headers: {authorization: `Bearer ${second.body.token}`},
  });
  assert.equal(revoked.statusCode, 200);
  assert.equal(revoked.body.revokedCount, 1);

  const oldSession = await invokeRouter(router, {
    method: 'GET',
    url: '/session',
    headers: {authorization: `Bearer ${first.body.token}`},
  });
  assert.equal(oldSession.statusCode, 401);
});
