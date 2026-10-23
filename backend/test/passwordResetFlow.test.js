const assert = require('node:assert/strict');
const {before, beforeEach, test} = require('node:test');
const jwt = require('jsonwebtoken');
const {createAuthRouter} = require('../routes/auth');
const {passwordResetLimiter, authLoginLimiter} = require('../middleware/rateLimiter');
const {createPasswordResetTokenPayload} = require('../utils/passwordResetTokens');
const {hashPassword, verifyPassword} = require('../utils/passwordAuth');

const JWT_SECRET = 'test-secret-for-password-reset-tests-32-chars';

before(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  passwordResetLimiter.reset();
  authLoginLimiter.reset();
});

const createMockPrisma = () => {
  const users = new Map();
  const resetTokens = new Map();
  const auditLogs = [];
  const errorEvents = [];

  return {
    users,
    resetTokens,
    auditLogs,
    errorEvents,
    user: {
      findUnique: async ({where = {}} = {}) => {
        if (where.id !== undefined) return users.get(where.id) || null;
        if (where.email !== undefined) {
          for (const u of users.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      },
      update: async ({where, data}) => {
        const existing = users.get(where.id);
        if (!existing) throw new Error('User not found');
        const updated = {...existing, ...data};
        users.set(where.id, updated);
        return updated;
      },
    },
    passwordResetToken: {
      findUnique: async ({where = {}} = {}) => {
        if (where.tokenHash) {
          const record = resetTokens.get(where.tokenHash);
          if (!record) return null;
          const user = users.get(record.userId);
          return {...record, user};
        }
        return null;
      },
      update: async ({where, data}) => {
        for (const [hash, record] of resetTokens.entries()) {
          if (record.id === where.id) {
            const updated = {...record, ...data};
            resetTokens.set(hash, updated);
            return updated;
          }
        }
        throw new Error('Token not found');
      },
      updateMany: async ({where, data}) => {
        let count = 0;
        for (const [hash, record] of resetTokens.entries()) {
          if (record.userId === where.userId && (where.usedAt === null ? record.usedAt === null : true)) {
            resetTokens.set(hash, {...record, ...data});
            count += 1;
          }
        }
        return {count};
      },
      create: async ({data}) => {
        const id = resetTokens.size + 1;
        const record = {id, ...data};
        resetTokens.set(data.tokenHash, record);
        return record;
      },
    },
    auditLog: {
      create: async ({data}) => {
        auditLogs.push(data);
        return {id: auditLogs.length, ...data};
      },
    },
    errorEvent: {
      create: async ({data}) => {
        errorEvents.push(data);
        return {id: errorEvents.length, ...data};
      },
    },
    $transaction: async (ops) => Promise.all(ops),
  };
};

const invokeRouter = async (router, {method, url, body = {}, headers = {}}) => {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: `/api/auth${url}`,
      body,
      headers,
      params: {},
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({statusCode: this.statusCode, body: payload});
        return this;
      },
    };

    router.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({statusCode: res.statusCode, body: res.body});
    });
  });
};

test('Backend Password Change: staff password remains owner-managed', async () => {
  const prisma = createMockPrisma();
  const authRouter = createAuthRouter({prismaClient: prisma});
  const passwordHash = await hashPassword('InitialPass#2026!');
  const staffUser = {
    id: 3,
    email: 'staff@nuarr.pl',
    name: 'Staff',
    role: 'staff',
    isActive: true,
    employeeId: 2,
    permissions: {},
    passwordChangedAt: null,
    passwordHash,
  };
  prisma.users.set(staffUser.id, staffUser);
  const token = jwt.sign(
    {
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      employeeId: staffUser.employeeId,
    },
    JWT_SECRET,
    {subject: String(staffUser.id)},
  );

  const response = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/change-password',
    headers: {authorization: `Bearer ${token}`},
    body: {
      currentPassword: 'InitialPass#2026!',
      newPassword: 'AnotherSafePass#2026!',
    },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /изменяет владелец/);
  assert.equal(prisma.users.get(staffUser.id).passwordHash, passwordHash);
});

test('Backend Password Reset: Rejects missing token or missing password', async () => {
  const prisma = createMockPrisma();
  const authRouter = createAuthRouter({prismaClient: prisma});

  // 1. Missing both
  const res1 = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {},
  });
  assert.equal(res1.statusCode, 400);
  assert.match(res1.body.error, /Token and newPassword are required/);

  // 2. Missing password
  const res2 = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {token: 'some-token'},
  });
  assert.equal(res2.statusCode, 400);
  assert.match(res2.body.error, /Token and newPassword are required/);

  // 3. Missing token
  const res3 = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {newPassword: 'SafePassword#2026!'},
  });
  assert.equal(res3.statusCode, 400);
  assert.match(res3.body.error, /Token and newPassword are required/);
});

test('Backend Password Reset: Rejects invalid, expired, or reused tokens', async () => {
  const prisma = createMockPrisma();
  const authRouter = createAuthRouter({prismaClient: prisma});

  // Seed user
  const initialHash = await hashPassword('OldPassword#2026!');
  prisma.users.set(1, {
    id: 1,
    email: 'olga@nuarr.pl',
    name: 'Ольга',
    role: 'staff',
    isActive: true,
    passwordHash: initialHash,
    passwordChangedAt: null,
  });

  // 1. Non-existent token
  const nonExistentRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token: 'non-existent-random-token',
      newPassword: 'NewSafePassword#2026!',
    },
  });
  assert.equal(nonExistentRes.statusCode, 400);
  assert.equal(nonExistentRes.body.error, 'Ссылка недействительна или срок её действия истёк');

  // 2. Expired token (expiresAt in the past)
  const expiredPayload = createPasswordResetTokenPayload();
  prisma.resetTokens.set(expiredPayload.tokenHash, {
    id: 1,
    tokenHash: expiredPayload.tokenHash,
    userId: 1,
    expiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
    usedAt: null,
  });

  const expiredRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token: expiredPayload.token,
      newPassword: 'NewSafePassword#2026!',
    },
  });
  assert.equal(expiredRes.statusCode, 400);
  assert.equal(expiredRes.body.error, 'Ссылка недействительна или срок её действия истёк');

  // 3. Already used token (usedAt not null)
  const usedPayload = createPasswordResetTokenPayload();
  prisma.resetTokens.set(usedPayload.tokenHash, {
    id: 2,
    tokenHash: usedPayload.tokenHash,
    userId: 1,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    usedAt: new Date(Date.now() - 60 * 1000), // Already used 1 min ago
  });

  const usedRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token: usedPayload.token,
      newPassword: 'NewSafePassword#2026!',
    },
  });
  assert.equal(usedRes.statusCode, 400);
  assert.equal(usedRes.body.error, 'Ссылка недействительна или срок её действия истёк');
});

test('Backend Password Reset: Successful reset updates password, prevents reuse, and allows login', async () => {
  const prisma = createMockPrisma();
  const authRouter = createAuthRouter({prismaClient: prisma});

  const initialHash = await hashPassword('InitialPass#2026!');
  prisma.users.set(2, {
    id: 2,
    email: 'maxim@nuarr.pl',
    name: 'Максим',
    role: 'staff',
    isActive: true,
    passwordHash: initialHash,
    passwordChangedAt: null,
  });

  // Create valid reset token payload
  const validPayload = createPasswordResetTokenPayload();
  prisma.resetTokens.set(validPayload.tokenHash, {
    id: 10,
    tokenHash: validPayload.tokenHash,
    userId: 2,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    usedAt: null,
  });

  const newPassword = 'SafeTherapist#2026!Key';

  // 1. Submit valid password reset
  const resetRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token: validPayload.token,
      newPassword,
    },
  });

  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.body.success, true);

  // 2. Verify DB state: password hash updated and token marked used
  const updatedUser = prisma.users.get(2);
  assert.ok(updatedUser.passwordChangedAt instanceof Date);
  assert.equal(await verifyPassword(newPassword, updatedUser.passwordHash), true);
  assert.equal(await verifyPassword('InitialPass#2026!', updatedUser.passwordHash), false);

  const updatedToken = prisma.resetTokens.get(validPayload.tokenHash);
  assert.ok(updatedToken.usedAt instanceof Date);

  // 3. Re-using the same token must now FAIL
  const replayRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token: validPayload.token,
      newPassword: 'AnotherPassword#2026!Pass',
    },
  });

  assert.equal(replayRes.statusCode, 400);
  assert.equal(replayRes.body.error, 'Ссылка недействительна или срок её действия истёк');

  // 4. Login with new password succeeds
  const loginRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'maxim@nuarr.pl',
      password: newPassword,
    },
  });

  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.success, true);
  assert.ok(loginRes.body.token);
  assert.equal(loginRes.body.user.email, 'maxim@nuarr.pl');
});
