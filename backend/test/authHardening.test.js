const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const {
  isOwnerAuth,
  createActiveUserMiddleware,
  invalidateUserCache,
} = require('../middleware/auth');

const JWT_SECRET = 'test-secret-for-auth-hardening-tests-32-chars';

before(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.ADMIN_EMAIL = 'admin@nuarr.pl';
});

beforeEach(() => {
  invalidateUserCache();
});

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  },
});

test('auth hardening: isOwnerAuth rejects email escalation when role is not owner', () => {
  // Staff user with admin@nuarr.pl email must NOT be treated as owner
  const staffWithAdminEmail = {
    id: '42',
    email: 'admin@nuarr.pl',
    role: 'staff',
  };
  assert.equal(isOwnerAuth(staffWithAdminEmail), false);

  // Legitimate owner role is accepted
  const legitOwner = {
    id: '1',
    email: 'owner@nuarr.pl',
    role: 'owner',
  };
  assert.equal(isOwnerAuth(legitOwner), true);

  // Local-admin emergency fallback token is accepted by isOwnerAuth
  assert.equal(isOwnerAuth({ id: 'local-admin', role: 'owner' }), true);
});

test('auth hardening: requireActiveUser rejects local-admin when DB owners exist', async () => {
  const mockPrisma = {
    user: {
      count: async ({ where }) => {
        if (where?.role === 'owner' && where?.isActive === true) {
          return 1; // 1 active owner exists in DB
        }
        return 0;
      },
    },
  };

  const middleware = createActiveUserMiddleware(mockPrisma);
  const req = {
    auth: {
      id: 'local-admin',
      sub: 'local-admin',
      role: 'owner',
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.body?.error, /Emergency local-admin is disabled/);
});

test('auth hardening: requireActiveUser allows local-admin only during bootstrapping (0 DB owners)', async () => {
  const mockPrisma = {
    user: {
      count: async () => 0, // No owners in DB
    },
  };

  const middleware = createActiveUserMiddleware(mockPrisma);
  const req = {
    auth: {
      id: 'local-admin',
      sub: 'local-admin',
      role: 'owner',
    },
  };
  const res = createResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('auth hardening: requireActiveUser rejects non-numeric or invalid user IDs', async () => {
  const mockPrisma = { user: { count: async () => 0 } };
  const middleware = createActiveUserMiddleware(mockPrisma);

  for (const badId of ['not-a-number', '0', '-5', 'NaN', '']) {
    const req = { auth: { id: badId, role: 'staff' } };
    const res = createResponse();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, `Expected bad ID ${badId} to be rejected`);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.error, 'Invalid user ID in token');
  }
});

test('auth hardening: requireActiveUser rejects JWT issued before password change (both uncached and cached)', async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const passwordChangedAt = new Date((nowSec - 100) * 1000); // Changed 100 seconds ago

  const dbUser = {
    id: 10,
    email: 'user10@nuarr.pl',
    name: 'User 10',
    role: 'staff',
    isActive: true,
    employeeId: 5,
    permissions: {},
    passwordChangedAt,
  };

  let queryCount = 0;
  const mockPrisma = {
    user: {
      findUnique: async ({ where }) => {
        if (where.id === 10) {
          queryCount += 1;
          return dbUser;
        }
        return null;
      },
    },
  };

  const middleware = createActiveUserMiddleware(mockPrisma);

  // 1. Fresh (uncached) lookup with an expired/pre-rotation token (iat = 200s ago)
  const reqExpired = {
    auth: {
      id: '10',
      iat: nowSec - 200, // issued BEFORE passwordChangedAt
    },
  };
  const resExpired = createResponse();
  let nextCalledExpired = false;

  await middleware(reqExpired, resExpired, () => {
    nextCalledExpired = true;
  });

  assert.equal(nextCalledExpired, false);
  assert.equal(resExpired.statusCode, 401);
  assert.match(resExpired.body?.error, /Password changed, please log in again/);
  assert.equal(queryCount, 1);

  // 2. Lookup with a valid post-rotation token (iat = 50s ago) populates the cache
  const reqValid = {
    auth: {
      id: '10',
      iat: nowSec - 50, // issued AFTER passwordChangedAt
    },
  };
  const resValid = createResponse();
  let nextCalledValid = false;

  await middleware(reqValid, resValid, () => {
    nextCalledValid = true;
  });

  assert.equal(nextCalledValid, true);
  assert.equal(queryCount, 2); // Fetched and cached

  // 3. Now test CACHED branch with pre-rotation token: MUST still be rejected!
  const reqCachedExpired = {
    auth: {
      id: '10',
      iat: nowSec - 200, // old token arriving while user is cached
    },
  };
  const resCachedExpired = createResponse();
  let nextCalledCachedExpired = false;

  await middleware(reqCachedExpired, resCachedExpired, () => {
    nextCalledCachedExpired = true;
  });

  assert.equal(nextCalledCachedExpired, false);
  assert.equal(resCachedExpired.statusCode, 401);
  assert.match(resCachedExpired.body?.error, /Password changed, please log in again/);
  assert.equal(queryCount, 2); // Ensured it didn't even need DB query to enforce password rotation!
});

test('auth hardening: invalidateUserCache purges cached users', async () => {
  let queries = 0;
  const mockPrisma = {
    user: {
      findUnique: async () => {
        queries += 1;
        return {
          id: 7,
          email: 'test@nuarr.pl',
          role: 'staff',
          isActive: true,
          employeeId: null,
          permissions: {},
          passwordChangedAt: null,
        };
      },
    },
  };

  const middleware = createActiveUserMiddleware(mockPrisma);
  const req = { auth: { id: '7' } };

  // First call: queries DB
  await middleware(req, createResponse(), () => {});
  assert.equal(queries, 1);

  // Second call: cached
  await middleware(req, createResponse(), () => {});
  assert.equal(queries, 1);

  // Invalidate specific user
  invalidateUserCache(7);

  // Third call: re-queries DB
  await middleware(req, createResponse(), () => {});
  assert.equal(queries, 2);
});
