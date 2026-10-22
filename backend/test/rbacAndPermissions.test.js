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
  assert.equal(staffPerms[PERMISSIONS.CLIENTS_VIEW_CONTACTS], true);
  assert.equal(staffPerms[PERMISSIONS.CLIENTS_MANAGE], true);
  assert.equal(staffPerms[PERMISSIONS.CALENDAR_VIEW_ALL], false);
  assert.equal(staffPerms[PERMISSIONS.CALENDAR_VIEW_ASSIGNED], true);
  assert.equal(staffPerms[PERMISSIONS.PAYOUTS_VIEW_OWN], true);
  assert.equal(staffPerms[PERMISSIONS.CATALOG_VIEW], true);
  assert.equal(staffPerms[PERMISSIONS.TASKS_MANAGE], false);

  const unknownPerms = getEffectivePermissions(undefined);
  assert.equal(Object.values(unknownPerms).some(Boolean), false);

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

test('admin can manage staff but cannot modify an owner account or assign owner', async () => {
  const records = new Map([
    [1, {
      id: 1,
      email: 'owner@nuarr.pl',
      name: 'Owner',
      role: 'owner',
      isActive: true,
      employeeId: null,
      permissions: {},
    }],
    [2, {
      id: 2,
      email: 'master@nuarr.pl',
      name: 'Master',
      role: 'staff',
      isActive: true,
      employeeId: 3,
      permissions: {},
    }],
  ]);
  const mockDb = {
    user: {
      findUnique: async ({where}) => records.get(Number(where.id)) || null,
      update: async ({where, data}) => {
        const next = {...records.get(Number(where.id)), ...data};
        records.set(Number(where.id), next);
        return next;
      },
      count: async () => 1,
    },
    auditLog: {create: async () => ({})},
    errorEvent: {create: async () => ({})},
  };
  const usersRouter = defaultUsersRouter.createUsersRouter({prismaClient: mockDb});
  const admin = {id: '9', role: 'admin'};

  const staffUpdate = await invokeRouter(usersRouter, {
    method: 'PUT',
    url: '/users/2',
    auth: admin,
    body: {name: 'Updated Master', role: 'staff'},
  });
  assert.equal(staffUpdate.statusCode, 200);
  assert.equal(staffUpdate.body.user.name, 'Updated Master');

  const ownerUpdate = await invokeRouter(usersRouter, {
    method: 'PUT',
    url: '/users/1',
    auth: admin,
    body: {name: 'Changed Owner'},
  });
  assert.equal(ownerUpdate.statusCode, 403);
  assert.match(ownerUpdate.body.error, /Только владелец/);

  const promoteStaff = await invokeRouter(usersRouter, {
    method: 'PUT',
    url: '/users/2',
    auth: admin,
    body: {role: 'owner'},
  });
  assert.equal(promoteStaff.statusCode, 403);
});

test('operations notes access: staff can view shared work notes and own private notes, but not owner notes or others private notes', () => {
  const operationsRouter = require('../routes/operations');
  const { canAccessNote } = operationsRouter;

  const staffAuth = { id: '10', sub: '10', role: 'staff' };
  const adminAuth = { id: '2', sub: '2', role: 'admin' };
  const ownerAuth = { id: '1', sub: '1', role: 'owner' };
  const otherStaffAuth = { id: '20', sub: '20', role: 'staff' };

  const workNote = {
    type: 'note',
    payload: { visibility: 'work', ownerUserId: '2' },
  };
  const ownPrivateNote = {
    type: 'note',
    payload: { visibility: 'private', ownerUserId: '10' },
  };
  const otherPrivateNote = {
    type: 'note',
    payload: { visibility: 'private', ownerUserId: '20' },
  };
  const ownerOnlyNote = {
    type: 'note',
    payload: { visibility: 'owner', ownerUserId: '1' },
  };

  // Staff tests
  assert.equal(canAccessNote(staffAuth, workNote), true, 'Staff can access shared work note');
  assert.equal(canAccessNote(staffAuth, ownPrivateNote), true, 'Staff can access own private note');
  assert.equal(canAccessNote(staffAuth, otherPrivateNote), false, 'Staff cannot access another user private note');
  assert.equal(canAccessNote(otherStaffAuth, otherPrivateNote), true, 'Other staff can access their own private note');
  assert.equal(canAccessNote(staffAuth, ownerOnlyNote), false, 'Staff cannot access owner-only note');

  // Admin tests
  assert.equal(canAccessNote(adminAuth, workNote), true, 'Admin can access shared work note');
  assert.equal(canAccessNote(adminAuth, otherPrivateNote), false, 'Admin cannot access staff private note');
  assert.equal(canAccessNote(adminAuth, ownerOnlyNote), false, 'Admin cannot access owner-only note');

  // Owner tests
  assert.equal(canAccessNote(ownerAuth, workNote), true, 'Owner can access shared work note');
  assert.equal(canAccessNote(ownerAuth, ownerOnlyNote), true, 'Owner can access owner note');
  assert.equal(canAccessNote(ownerAuth, ownPrivateNote), false, 'Owner cannot access other private note unless owned');

  // Fail closed for unauthenticated / unknown role
  assert.equal(canAccessNote(null, workNote), false, 'Null auth fails closed');
  assert.equal(canAccessNote({ role: 'unknown' }, workNote), false, 'Unknown role fails closed');
});

test('loyalty card search preserves assigned-client isolation for staff', () => {
  const {buildLoyaltyCardsWhere} = require('../routes/loyalty');
  const where = buildLoyaltyCardsWhere(
    {
      role: 'staff',
      employeeId: 42,
      effectivePermissions: {[PERMISSIONS.CALENDAR_VIEW_ALL]: false},
    },
    {search: 'Anna', status: 'active', reward: 'available'},
  );

  assert.deepEqual(where.client.AND[0], {visits: {some: {employeeId: 42}}});
  assert.deepEqual(where.client.AND[1].OR[0], {
    name: {contains: 'Anna', mode: 'insensitive'},
  });
  assert.equal(where.isActive, true);
  assert.equal(where.rewardAvailable, true);
});

test('loyalty card list fails closed when assigned-only user has no employee binding', () => {
  const {buildLoyaltyCardsWhere} = require('../routes/loyalty');
  const where = buildLoyaltyCardsWhere({
    role: 'staff',
    employeeId: null,
    effectivePermissions: {[PERMISSIONS.CALENDAR_VIEW_ALL]: false},
  }, {search: 'Anna'});

  assert.deepEqual(where, {id: -1});
});

test('system state endpoint rejects staff before reading shared settings', async () => {
  const systemStateRouter = require('../routes/systemState');
  const response = await invokeRouter(systemStateRouter, {
    method: 'GET',
    url: '/system-state',
    auth: {
      role: 'staff',
      employeeId: 42,
      effectivePermissions: {[PERMISSIONS.USERS_MANAGE]: false},
    },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.error, /users\.manage/);
});

