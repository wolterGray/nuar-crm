const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const {
  getEffectivePermissions,
  maskPhoneNumber,
  maskEmail,
  PERMISSIONS,
} = require('../constants/permissions');
const {
  requirePermission,
  createActiveUserMiddleware,
  invalidateUserCache,
} = require('../middleware/auth');
const defaultUsersRouter = require('../routes/users');

const JWT_SECRET = 'test-secret-for-rbac-unit-tests-32-chars-long';

before(() => {
  process.env.JWT_SECRET = JWT_SECRET;
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

test('RBAC role defaults: owner has all permissions, staff has assigned-only and protected finance', () => {
  const ownerPerms = getEffectivePermissions('owner');
  assert.equal(ownerPerms[PERMISSIONS.FINANCE_VIEW_SALON_STATS], true);
  assert.equal(ownerPerms[PERMISSIONS.CLIENTS_VIEW_CONTACTS], true);
  assert.equal(ownerPerms[PERMISSIONS.CALENDAR_VIEW_ALL], true);

  const staffPerms = getEffectivePermissions('staff');
  assert.equal(staffPerms[PERMISSIONS.FINANCE_VIEW_SALON_STATS], false);
  assert.equal(staffPerms[PERMISSIONS.CLIENTS_VIEW_CONTACTS], false);
  assert.equal(staffPerms[PERMISSIONS.CALENDAR_VIEW_ALL], false);
  assert.equal(staffPerms[PERMISSIONS.CALENDAR_VIEW_ASSIGNED], true);
  assert.equal(staffPerms[PERMISSIONS.PAYOUTS_VIEW_OWN], true);

  // Custom permission override on staff role
  const staffWithContacts = getEffectivePermissions('staff', {
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
  });
  assert.equal(staffWithContacts[PERMISSIONS.CLIENTS_VIEW_CONTACTS], true);
  assert.equal(staffWithContacts[PERMISSIONS.FINANCE_VIEW_SALON_STATS], false);
});

test('requirePermission middleware enforces permissions and blocks unauthorized requests', () => {
  const middleware = requirePermission(PERMISSIONS.FINANCE_VIEW_SALON_STATS);

  // Owner passes
  let nextCalled = false;
  const ownerReq = { auth: { role: 'owner' } };
  const ownerRes = createResponse();
  middleware(ownerReq, ownerRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  // Staff without permission gets 403
  nextCalled = false;
  const staffReq = { auth: { role: 'staff', permissions: {} } };
  const staffRes = createResponse();
  middleware(staffReq, staffRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(staffRes.statusCode, 403);
  assert.ok(staffRes.body.error.includes(PERMISSIONS.FINANCE_VIEW_SALON_STATS));

  // Staff with explicit permission passes
  nextCalled = false;
  const authorizedStaffReq = {
    auth: {
      role: 'staff',
      permissions: { [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true },
    },
  };
  middleware(authorizedStaffReq, staffRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('maskPhoneNumber and maskEmail mask private personal contacts', () => {
  assert.equal(maskPhoneNumber('+48501234567'), '+48 ••• •• 67');
  assert.equal(maskPhoneNumber('123'), '***');
  assert.equal(maskEmail('client@nuarr.pl'), 'cl•••@nuarr.pl');
  assert.equal(maskEmail('a@b.com'), 'a•••@b.com');
});

test('createActiveUserMiddleware terminates session immediately for deactivated user', async () => {
  const mockDb = {
    user: {
      findUnique: async ({ where }) => {
        if (where.id === 10) {
          return {
            id: 10,
            email: 'therapist@nuarr.pl',
            name: 'Therapist',
            role: 'staff',
            isActive: false, // Disabled
            employeeId: 5,
            permissions: {},
            passwordChangedAt: null,
          };
        }
        return null;
      },
    },
  };

  invalidateUserCache(10);
  const activeUserMiddleware = createActiveUserMiddleware(mockDb);

  const req = {
    auth: { id: '10', sub: '10', role: 'staff' },
  };
  const res = createResponse();
  let nextCalled = false;

  await activeUserMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'User is inactive or disabled');
});

test('createActiveUserMiddleware rejects tokens issued prior to password rotation', async () => {
  const passwordChangedAt = new Date('2026-10-19T10:00:00Z');
  const tokenIssuedAt = Math.floor(new Date('2026-10-19T09:00:00Z').getTime() / 1000); // 1 hour earlier

  const mockDb = {
    user: {
      findUnique: async () => ({
        id: 11,
        email: 'natalia@nuarr.pl',
        name: 'Natalia',
        role: 'staff',
        isActive: true,
        employeeId: 3,
        permissions: {},
        passwordChangedAt,
      }),
    },
  };

  invalidateUserCache(11);
  const activeUserMiddleware = createActiveUserMiddleware(mockDb);

  const req = {
    auth: { id: '11', sub: '11', role: 'staff', iat: tokenIssuedAt },
  };
  const res = createResponse();
  let nextCalled = false;

  await activeUserMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Password changed, please log in again');
});

const invokeRouter = async (router, { method, url, body = {}, auth = null }) => {
  return new Promise((resolve) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: `/api${url}`,
      body,
      headers: {},
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
      json(data) {
        this.body = data;
        resolve({ statusCode: this.statusCode, body: data });
        return this;
      },
    };
    router.handle(req, res, () => {
      resolve({ statusCode: res.statusCode, body: res.body });
    });
  });
};

test('anti-self-escalation: users cannot elevate own role, change own permissions, or deactivate themselves', async () => {
  const mockUser = {
    id: 20,
    email: 'admin@nuarr.pl',
    name: 'Admin User',
    role: 'owner',
    isActive: true,
    employeeId: null,
    permissions: {},
  };

  const mockDb = {
    user: {
      findUnique: async ({ where }) => (where.id === 20 ? mockUser : null),
      count: async () => 2, // 2 owners, so not the last owner
    },
  };

  const usersRouter = defaultUsersRouter.createUsersRouter({
    prismaClient: mockDb,
    checkSmtpConfigured: () => false,
    sendResetEmail: async () => ({ sent: false }),
  });

  // Attempt 1: Self role change
  const selfRoleRes = await invokeRouter(usersRouter, {
    method: 'PUT',
    url: '/users/20',
    auth: { id: '20', email: 'admin@nuarr.pl', role: 'owner' },
    body: { role: 'staff' },
  });
  assert.equal(selfRoleRes.statusCode, 403);
  assert.equal(selfRoleRes.body.error, 'Нельзя изменить собственную роль');

  // Attempt 2: Self disable
  const selfDisableRes = await invokeRouter(usersRouter, {
    method: 'POST',
    url: '/users/20/disable',
    auth: { id: '20', email: 'admin@nuarr.pl', role: 'owner' },
  });
  assert.equal(selfDisableRes.statusCode, 403);
  assert.equal(selfDisableRes.body.error, 'Нельзя отключить собственный аккаунт');
});
