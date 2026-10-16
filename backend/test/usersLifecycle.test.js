const assert = require('node:assert/strict');
const {before, test} = require('node:test');
const {createUsersRouter} = require('../routes/users');
const {createAuthRouter} = require('../routes/auth');
const {
  createStrongTemporaryPassword,
  validatePasswordStrength,
  verifyPassword,
} = require('../utils/passwordAuth');

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

const invokeRouter = async (router, {method, url, body = {}, headers = {}, auth = null}) => {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: `/api${url}`,
      body,
      headers,
      auth,
      params: {},
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

before(() => {
  process.env.JWT_SECRET = 'test-secret-for-users-lifecycle-32-chars!!';
});

test('createStrongTemporaryPassword and validatePasswordStrength return both ok and isValid', () => {
  const pwd = createStrongTemporaryPassword({email: 'natalia@nuarr.pl', role: 'staff'});
  const strength = validatePasswordStrength(pwd, {email: 'natalia@nuarr.pl', role: 'staff'});

  assert.equal(strength.ok, true);
  assert.equal(strength.isValid, true);
  assert.equal(strength.failures.length, 0);
});

test('full user lifecycle: create -> set password -> login -> check role -> update -> disable -> block access', async () => {
  const prisma = createMockPrisma();
  const usersRouter = createUsersRouter({
    prismaClient: prisma,
    sendResetEmail: async () => ({sent: false, reason: 'smtp not configured'}),
    checkSmtpConfigured: () => false,
  });
  const authRouter = createAuthRouter({
    prismaClient: prisma,
    sendResetEmail: async () => ({sent: false, reason: 'smtp not configured'}),
    checkSmtpConfigured: () => false,
  });

  // 1. Seed initial owner in mock DB
  await prisma.user.create({
    data: {
      email: 'owner@nuarr.pl',
      name: 'Volodymyr',
      passwordHash: 'initial-hash',
      role: 'owner',
      isActive: true,
    },
  });

  // 2. Owner creates a new staff user via POST /users
  const createRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    headers: {origin: 'https://crm.nuarr.pl'},
    body: {
      name: 'Наталья',
      email: 'Natalia@nuarr.pl',
      role: 'staff',
    },
  });

  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.user.email, 'natalia@nuarr.pl');
  assert.equal(createRes.body.user.name, 'Наталья');
  assert.equal(createRes.body.user.role, 'staff');
  assert.equal(createRes.body.user.isActive, true);
  assert.equal(createRes.body.resetEmailSent, false);
  assert.equal(createRes.body.smtpConfigured, false);
  assert.ok(createRes.body.resetUrl.startsWith('https://crm.nuarr.pl/reset-password?token='));

  // Verify password was stored as bcrypt hash and not plain text
  const createdDbUser = prisma.users.get(createRes.body.user.id);
  assert.ok(createdDbUser.passwordHash.startsWith('$2'));

  // 3. Extract token from resetUrl and set employee password via POST /reset-password
  const token = new URL(createRes.body.resetUrl).searchParams.get('token');
  assert.ok(token);

  const newEmployeePassword = 'SafeStaff#2026!Pass';
  const resetRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token,
      newPassword: newEmployeePassword,
    },
  });

  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.body.success, true);
  assert.equal(await verifyPassword(newEmployeePassword, createdDbUser.passwordHash), true);

  // Reusing the same token must fail
  const reuseRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/reset-password',
    body: {
      token,
      newPassword: 'Another#2026!Pass',
    },
  });
  assert.equal(reuseRes.statusCode, 400);

  // 4. Employee logs in via POST /login
  const loginRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'natalia@nuarr.pl',
      password: newEmployeePassword,
    },
  });

  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.success, true);
  assert.ok(loginRes.body.token);
  assert.equal(loginRes.body.user.email, 'natalia@nuarr.pl');
  assert.equal(loginRes.body.user.name, 'Наталья');
  assert.equal(loginRes.body.user.role, 'staff');

  // 5. Verify session & role enforcement
  const sessionRes = await invokeRouter(authRouter, {
    method: 'GET',
    url: '/session',
    headers: {authorization: `Bearer ${loginRes.body.token}`},
  });
  assert.equal(sessionRes.statusCode, 200);
  assert.equal(sessionRes.body.user.role, 'staff');
  assert.equal(sessionRes.body.user.name, 'Наталья');

  // Staff cannot access owner-only users endpoint
  const staffAttemptRes = await invokeRouter(usersRouter, {
    method: 'GET',
    url: '/users',
    auth: {id: String(createdDbUser.id), email: 'natalia@nuarr.pl', role: 'staff'},
  });
  assert.equal(staffAttemptRes.statusCode, 403);

  // 6. Owner updates employee role to manager via PUT /users/:id
  const updateRes = await invokeRouter(usersRouter, {
    method: 'PUT',
    url: `/users/${createdDbUser.id}`,
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
    body: {
      email: 'natalia@nuarr.pl',
      name: 'Наталья Старшая',
      role: 'manager',
    },
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.body.user.role, 'manager');
  assert.equal(updateRes.body.user.name, 'Наталья Старшая');

  // Session immediately reflects updated role and name from DB
  const updatedSessionRes = await invokeRouter(authRouter, {
    method: 'GET',
    url: '/session',
    headers: {authorization: `Bearer ${loginRes.body.token}`},
  });
  assert.equal(updatedSessionRes.statusCode, 200);
  assert.equal(updatedSessionRes.body.user.role, 'manager');
  assert.equal(updatedSessionRes.body.user.name, 'Наталья Старшая');

  // 7. Cannot disable the last active owner
  const disableOwnerRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users/1/disable',
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
  });
  assert.equal(disableOwnerRes.statusCode, 409);

  // 8. Owner disables the employee via POST /users/:id/disable
  const disableStaffRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${createdDbUser.id}/disable`,
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
  });
  assert.equal(disableStaffRes.statusCode, 200);
  assert.equal(disableStaffRes.body.user.isActive, false);

  // Disabled employee cannot log in
  const disabledLoginRes = await invokeRouter(authRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'natalia@nuarr.pl',
      password: newEmployeePassword,
    },
  });
  assert.equal(disabledLoginRes.statusCode, 401);

  // Disabled employee's existing token is rejected on /session
  const disabledSessionRes = await invokeRouter(authRouter, {
    method: 'GET',
    url: '/session',
    headers: {authorization: `Bearer ${loginRes.body.token}`},
  });
  assert.equal(disabledSessionRes.statusCode, 401);

  // 9. Owner re-enables employee via POST /users/:id/enable
  const enableStaffRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: `/users/${createdDbUser.id}/enable`,
    auth: {id: '1', email: 'owner@nuarr.pl', role: 'owner'},
  });
  assert.equal(enableStaffRes.statusCode, 200);
  assert.equal(enableStaffRes.body.user.isActive, true);
});
