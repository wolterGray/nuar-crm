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
    findUnique: async ({where}) => {
      const key = where.userId_deviceId;
      if (!key) return null;
      return Array.from(sessions.values()).find(
        (session) => session.userId === key.userId && session.deviceId === key.deviceId,
      ) || null;
    },
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

test('auth refresh: login issues a reusable device refresh token without cross-tab rotation', async () => {
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
  assert.equal(refreshed.body.refreshToken, login.body.refreshToken);
  assert.equal(refreshed.body.user.id, String(user.id));
  assert.equal(jwt.verify(refreshed.body.token, JWT_SECRET).tokenType, undefined);

  const concurrentRefresh = await invokeRouter(router, {
    method: 'POST',
    url: '/refresh',
    body: {refreshToken: login.body.refreshToken},
  });
  assert.equal(concurrentRefresh.statusCode, 200);
  assert.equal(concurrentRefresh.body.refreshToken, login.body.refreshToken);
});

test('auth sessions: repeated login on one device reuses a single session', async () => {
  const user = {
    id: 10,
    email: 'stable-device@nuarr.pl',
    name: 'Stable Device',
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
  const request = {
    method: 'POST',
    url: '/login',
    body: {
      deviceId: 'device-1234567890abcdef',
      email: user.email,
      password: 'StrongPassword#2026',
    },
    headers: {'user-agent': 'Mozilla/5.0 (iPhone)'},
  };

  const first = await invokeRouter(router, request);
  const second = await invokeRouter(router, request);
  const sessions = await invokeRouter(router, {
    method: 'GET',
    url: '/sessions',
    headers: {authorization: `Bearer ${second.body.token}`},
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(sessions.body.sessions.length, 1);
  assert.equal(
    jwt.verify(first.body.refreshToken, JWT_SECRET).sessionId,
    jwt.verify(second.body.refreshToken, JWT_SECRET).sessionId,
  );
});

test('auth sessions: first identified login removes legacy sessions without a device id', async () => {
  const user = {
    id: 11,
    email: 'legacy-device@nuarr.pl',
    name: 'Legacy Device',
    role: 'staff',
    isActive: true,
    employeeId: null,
    permissions: {},
    passwordChangedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    passwordHash: await hashPassword('StrongPassword#2026'),
  };
  const router = createAuthRouter({prismaClient: createPrisma(user)});

  await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {email: user.email, password: 'StrongPassword#2026'},
    headers: {'user-agent': 'Legacy Browser'},
  });
  const identified = await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {
      deviceId: 'device-abcdef1234567890',
      email: user.email,
      password: 'StrongPassword#2026',
    },
    headers: {'user-agent': 'Mozilla/5.0 (iPhone)'},
  });
  const sessions = await invokeRouter(router, {
    method: 'GET',
    url: '/sessions',
    headers: {authorization: `Bearer ${identified.body.token}`},
  });

  assert.equal(identified.statusCode, 200);
  assert.equal(sessions.statusCode, 200);
  assert.equal(sessions.body.sessions.length, 1);
  assert.equal(sessions.body.sessions[0].deviceName, 'iPhone');
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

test('auth login: an expired lock starts a new failed-attempt window', async () => {
  const user = {
    id: 9,
    email: 'expired-lock@nuarr.pl',
    name: 'Expired Lock',
    role: 'staff',
    isActive: true,
    employeeId: null,
    permissions: {},
    passwordChangedAt: null,
    failedLoginCount: 5,
    lockedUntil: new Date(Date.now() - 60_000),
    passwordHash: await hashPassword('StrongPassword#2026'),
  };
  const router = createAuthRouter({prismaClient: createPrisma(user)});

  const login = await invokeRouter(router, {
    method: 'POST',
    url: '/login',
    body: {email: user.email, password: 'WrongPassword#2026'},
  });

  assert.equal(login.statusCode, 401);
  assert.equal(user.failedLoginCount, 1);
  assert.equal(user.lockedUntil, null);
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
