const assert = require('node:assert/strict');
const {before, test} = require('node:test');
const {createUsersRouter} = require('../routes/users');
const {createAuthRouter} = require('../routes/auth');
const {isAllowedOrigin, getResetBaseUrl} = require('../utils/passwordResetTokens');
const {verifyPassword} = require('../utils/passwordAuth');

const createMockPrisma = () => {
  let nextUserId = 1;
  let nextTokenId = 1;
  const users = new Map();
  const resetTokens = new Map();
  const auditLogs = [];
  const errorEvents = [];

  const pickSelect = (record, select) => {
    if (!record || !select) return record ? {...record} : null;
    const out = {};
    for (const key of Object.keys(select)) {
      if (select[key]) out[key] = record[key];
    }
    return out;
  };

  return {
    users,
    resetTokens,
    auditLogs,
    errorEvents,
    user: {
      count: async ({where = {}} = {}) => {
        let count = 0;
        for (const u of users.values()) {
          if (where.isActive !== undefined && u.isActive !== where.isActive) continue;
          if (where.role !== undefined && u.role !== where.role) continue;
          count += 1;
        }
        return count;
      },
      findMany: async ({select} = {}) =>
        Array.from(users.values()).map((u) => pickSelect(u, select)),
      findUnique: async ({where, select} = {}) => {
        let found = null;
        if (where.id !== undefined) {
          found = users.get(Number(where.id)) || null;
        } else if (where.email !== undefined) {
          for (const u of users.values()) {
            if (u.email === where.email) {
              found = u;
              break;
            }
          }
        }
        return pickSelect(found, select);
      },
      create: async ({data, select}) => {
        for (const u of users.values()) {
          if (u.email === data.email) {
            const err = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
        }
        const now = new Date();
        const record = {
          id: nextUserId++,
          email: data.email,
          name: data.name || '',
          passwordHash: data.passwordHash,
          role: data.role || 'staff',
          isActive: data.isActive !== undefined ? data.isActive : true,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: null,
          passwordChangedAt: data.passwordChangedAt ?? null,
          permissions: data.permissions || {},
          createdAt: now,
          updatedAt: now,
        };
        users.set(record.id, record);
        return pickSelect(record, select);
      },
      update: async ({where, data, select}) => {
        const record = users.get(Number(where.id));
        if (!record) throw new Error('User not found');
        Object.assign(record, data, {updatedAt: new Date()});
        return pickSelect(record, select);
      },
    },
    passwordResetToken: {
      updateMany: async ({where, data}) => {
        let count = 0;
        for (const t of resetTokens.values()) {
          if (where.userId !== undefined && t.userId !== where.userId) continue;
          if (where.usedAt === null && t.usedAt !== null) continue;
          Object.assign(t, data);
          count += 1;
        }
        return {count};
      },
      create: async ({data}) => {
        const record = {
          id: nextTokenId++,
          tokenHash: data.tokenHash,
          userId: data.userId,
          expiresAt: data.expiresAt,
          usedAt: null,
          ip: data.ip || null,
          userAgent: data.userAgent || null,
          createdAt: new Date(),
        };
        resetTokens.set(record.id, record);
        return record;
      },
      findUnique: async ({where, include}) => {
        let found = null;
        for (const t of resetTokens.values()) {
          if (t.tokenHash === where.tokenHash) {
            found = {...t};
            break;
          }
        }
        if (found && include?.user) {
          found.user = users.get(found.userId) || null;
        }
        return found;
      },
      update: async ({where, data}) => {
        const record = resetTokens.get(Number(where.id));
        if (!record) throw new Error('Reset token not found');
        Object.assign(record, data);
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

const invokeRouter = (router, {method, url, body = {}, auth = null, headers = {}}) =>
  new Promise((resolve) => {
    const req = {
      method,
      url,
      originalUrl: url,
      body,
      auth,
      headers: {
        ...headers,
        host: headers.host || 'localhost:3000',
      },
      params: {},
    };

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({statusCode: this.statusCode, body: payload});
      },
      send(payload) {
        resolve({statusCode: this.statusCode, body: payload});
      },
    };

    router(req, res, () => {
      resolve({statusCode: 404, body: {error: 'Not found'}});
    });
  });

before(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-very-secure-32chars!!';
});

test('Origin header poisoning defense: rejects attacker domain and falls back to safe origin', () => {
  assert.equal(isAllowedOrigin('https://evil.com'), false);
  assert.equal(isAllowedOrigin('http://attacker.ru/reset'), false);
  assert.equal(isAllowedOrigin('https://crm.nuarr.pl'), true);

  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);
    process.env.NODE_ENV = 'production';
    assert.equal(isAllowedOrigin('http://localhost:5173'), false);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  const evilBaseUrl = getResetBaseUrl('https://evil.com');
  assert.ok(!evilBaseUrl.includes('evil.com'));
  assert.ok(evilBaseUrl.includes('crm.nuarr.pl') || evilBaseUrl.includes('localhost'));
});

test('User creation: Variant A (email invite), Variant B (generated temp password), Variant C (manual temp password)', async () => {
  const prisma = createMockPrisma();
  let emailSentCount = 0;
  const sendResetEmail = async ({email, resetUrl}) => {
    emailSentCount += 1;
    return {sent: true, messageId: `msg-${emailSentCount}`};
  };

  const usersRouter = createUsersRouter({
    prismaClient: prisma,
    sendResetEmail,
    checkSmtpConfigured: () => true,
  });

  // 1. Variant A: deliveryMethod = 'email'
  const resEmail = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    body: {
      email: 'user-a@nuarr.pl',
      name: 'User A',
      role: 'staff',
      deliveryMethod: 'email',
    },
  });

  assert.equal(resEmail.statusCode, 201);
  assert.equal(resEmail.body.user.email, 'user-a@nuarr.pl');
  assert.equal(resEmail.body.deliveryMethod, 'email');
  assert.equal(resEmail.body.resetEmailSent, true);
  assert.equal(emailSentCount, 1);

  // 2. Variant B: deliveryMethod = 'generate_temp'
  const resGen = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    body: {
      email: 'user-b@nuarr.pl',
      name: 'User B',
      role: 'staff',
      deliveryMethod: 'generate_temp',
    },
  });

  assert.equal(resGen.statusCode, 201);
  assert.equal(resGen.body.user.email, 'user-b@nuarr.pl');
  assert.equal(resGen.body.deliveryMethod, 'generate_temp');
  assert.ok(resGen.body.temporaryPassword);
  assert.ok(resGen.body.temporaryPassword.length >= 10);
  assert.equal(resGen.body.user.mustChangePassword, true);

  // 3. Variant C: deliveryMethod = 'manual_temp' with weak password -> rejected
  const resManualWeak = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    body: {
      email: 'user-c@nuarr.pl',
      name: 'User C',
      role: 'staff',
      deliveryMethod: 'manual_temp',
      temporaryPassword: '123',
    },
  });
  assert.equal(resManualWeak.statusCode, 422);

  // Variant C: deliveryMethod = 'manual_temp' with strong password -> accepted
  const resManualOk = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    body: {
      email: 'user-c@nuarr.pl',
      name: 'User C',
      role: 'staff',
      deliveryMethod: 'manual_temp',
      temporaryPassword: 'VeryStrongSec#2026Aa',
    },
  });
  assert.equal(resManualOk.statusCode, 201);
  assert.equal(resManualOk.body.user.mustChangePassword, true);
});

test('Password reset for existing user: generate temp, manual temp, email link, and owner protection', async () => {
  const prisma = createMockPrisma();
  let emailSentCount = 0;
  const sendResetEmail = async () => {
    emailSentCount += 1;
    return {sent: true, messageId: 'reset-msg-1'};
  };

  const usersRouter = createUsersRouter({
    prismaClient: prisma,
    sendResetEmail,
    checkSmtpConfigured: () => true,
  });

  // Seed owner and staff
  const owner = await prisma.user.create({
    data: {
      email: 'owner@nuarr.pl',
      name: 'Owner',
      role: 'owner',
      passwordHash: 'hash-owner',
      isActive: true,
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: 'staff@nuarr.pl',
      name: 'Staff',
      role: 'staff',
      passwordHash: 'hash-staff',
      isActive: true,
    },
  });
  const disabledUser = await prisma.user.create({
    data: {
      email: 'disabled@nuarr.pl',
      name: 'Disabled',
      role: 'staff',
      passwordHash: 'hash-disabled',
      isActive: false,
    },
  });

  // 1. Admin CANNOT reset Owner password
  const adminResetOwnerRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${owner.id}/reset-password`,
    auth: {id: '2', email: 'admin@nuarr.pl', role: 'admin'},
    body: {method: 'generate_temp'},
  });
  assert.equal(adminResetOwnerRes.statusCode, 403);

  // 2. Cannot reset disabled user
  const resetDisabledRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${disabledUser.id}/reset-password`,
    auth: {id: String(owner.id), email: owner.email, role: 'owner'},
    body: {method: 'generate_temp'},
  });
  assert.equal(resetDisabledRes.statusCode, 409);

  // 3. Reset via generate_temp
  const resetGenRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${staff.id}/reset-password`,
    auth: {id: String(owner.id), email: owner.email, role: 'owner'},
    body: {method: 'generate_temp'},
  });
  assert.equal(resetGenRes.statusCode, 200);
  assert.equal(resetGenRes.body.method, 'generate_temp');
  assert.ok(resetGenRes.body.temporaryPassword);
  assert.equal(resetGenRes.body.user.mustChangePassword, true);

  // Verify staff password hash was updated
  const updatedStaff = await prisma.user.findUnique({where: {id: staff.id}});
  assert.notEqual(updatedStaff.passwordHash, 'hash-staff');
  const valid = await verifyPassword(resetGenRes.body.temporaryPassword, updatedStaff.passwordHash);
  assert.equal(valid, true);
  assert.ok(updatedStaff.passwordChangedAt);

  // 4. Reset via manual_temp
  const resetManualRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${staff.id}/reset-password`,
    auth: {id: String(owner.id), email: owner.email, role: 'owner'},
    body: {method: 'manual_temp', temporaryPassword: 'ManualNewPass#2026'},
  });
  assert.equal(resetManualRes.statusCode, 200);
  assert.equal(resetManualRes.body.user.mustChangePassword, true);

  // 5. Reset via email
  const resetEmailRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${staff.id}/reset-password`,
    auth: {id: String(owner.id), email: owner.email, role: 'owner'},
    body: {method: 'email'},
  });
  assert.equal(resetEmailRes.statusCode, 200);
  assert.equal(resetEmailRes.body.resetEmailSent, true);
});
