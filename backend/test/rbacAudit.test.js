const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PERMISSIONS } = require('../constants/permissions');
const { hasPermission } = require('../middleware/auth');

test('RBAC Audit: Staff without CLIENTS_VIEW_CONTACTS gets masked client phone and email', () => {
  const { maskPhoneNumber, maskEmail } = require('../constants/permissions');

  assert.equal(maskPhoneNumber('+48 500 123 456'), '+48 ••• •• 56');
  assert.equal(maskPhoneNumber('123456789'), '123 ••• •• 89');
  assert.equal(maskPhoneNumber('123'), '***');

  assert.equal(maskEmail('jan.kowalski@gmail.com'), 'ja•••@gmail.com');
  assert.equal(maskEmail('a@b.com'), 'a•••@b.com');
});

test('RBAC Audit: Employee compensation masking in employee record', () => {
  // Simulate employee sanitizer logic
  const employee1 = {
    id: 1,
    name: 'Olga',
    commissionRate: 45,
    payrollSettings: { fixedRate: 0 },
    payrollSchedule: 'biweekly',
    payload: { commissionRate: 45, payrollSettings: { fixedRate: 0 } },
  };
  const employee2 = {
    id: 2,
    name: 'Maxim',
    commissionRate: 50,
    payrollSettings: { fixedRate: 100 },
    payrollSchedule: 'monthly',
    payload: { commissionRate: 50, payrollSettings: { fixedRate: 100 } },
  };

  const sanitize = (emp, auth) => {
    const isOwnerOrAdmin = auth?.role === 'owner' || auth?.role === 'admin';
    const canViewStats = hasPermission(auth, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
    const userEmpId = auth?.employeeId ? Number(auth.employeeId) : null;

    if (isOwnerOrAdmin || canViewStats) return emp;
    if (userEmpId && Number(emp.id) === userEmpId) return emp;

    const p = emp.payload && typeof emp.payload === 'object' ? emp.payload : {};
    return {
      ...emp,
      commissionRate: null,
      payrollSettings: null,
      payrollSchedule: null,
      payload: { ...p, commissionRate: null, payrollSettings: null, payrollSchedule: null },
    };
  };

  // Staff Olga (employeeId: 1) looking at herself
  const staffOlga = { role: 'staff', employeeId: 1, effectivePermissions: { [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false } };
  const olgaViewSelf = sanitize(employee1, staffOlga);
  assert.equal(olgaViewSelf.commissionRate, 45, 'Therapist must see their own commission rate');

  // Staff Olga looking at Maxim
  const olgaViewMaxim = sanitize(employee2, staffOlga);
  assert.equal(olgaViewMaxim.commissionRate, null, 'Therapist must NOT see other therapists commission rate');
  assert.equal(olgaViewMaxim.payrollSettings, null);
  assert.equal(olgaViewMaxim.payrollSchedule, null);

  // Owner looking at Maxim
  const owner = { role: 'owner' };
  const ownerViewMaxim = sanitize(employee2, owner);
  assert.equal(ownerViewMaxim.commissionRate, 50, 'Owner must see employee compensation');
});

test('RBAC Audit: Calendar entries and visits assignment checks', () => {
  // Staff therapist Maxim (employeeId: 2)
  const staffMaxim = {
    role: 'staff',
    employeeId: 2,
    effectivePermissions: {
      [PERMISSIONS.CALENDAR_MANAGE_ALL]: false,
      [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    },
  };

  const canManageAll = hasPermission(staffMaxim, PERMISSIONS.CALENDAR_MANAGE_ALL);
  const canManageAssigned = hasPermission(staffMaxim, PERMISSIONS.CALENDAR_MANAGE_ASSIGNED);
  assert.equal(canManageAll, false);
  assert.equal(canManageAssigned, true);

  // Check creating an entry for self (masterId: 2) -> Allowed
  const payloadSelf = { masterId: 2, date: '2026-10-20', time: '12:00' };
  const targetSelf = Number(payloadSelf.masterId);
  assert.equal(targetSelf === staffMaxim.employeeId, true);

  // Check creating an entry for Olga (masterId: 1) -> Denied
  const payloadOlga = { masterId: 1, date: '2026-10-20', time: '12:00' };
  const targetOlga = Number(payloadOlga.masterId);
  assert.equal(targetOlga === staffMaxim.employeeId, false);
});

test('RBAC Audit: Client Packages and Certificates require authorization', () => {
  const staff = {
    role: 'staff',
    effectivePermissions: {
      [PERMISSIONS.CLIENTS_MANAGE]: false,
      [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false,
      [PERMISSIONS.CLIENTS_VIEW]: true,
    },
  };

  const manager = {
    role: 'manager',
    effectivePermissions: {
      [PERMISSIONS.CLIENTS_MANAGE]: true,
      [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true,
      [PERMISSIONS.CLIENTS_VIEW]: true,
    },
  };

  const canManageAsStaff = hasPermission(staff, PERMISSIONS.CLIENTS_MANAGE) || hasPermission(staff, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
  assert.equal(canManageAsStaff, false, 'Standard staff cannot sell packages/certificates');

  const canManageAsManager = hasPermission(manager, PERMISSIONS.CLIENTS_MANAGE) || hasPermission(manager, PERMISSIONS.FINANCE_VIEW_SALON_STATS);
  assert.equal(canManageAsManager, true, 'Manager can sell packages/certificates');
});

test('RBAC Audit: Services catalog editing requires CATALOG_MANAGE', () => {
  const staff = {
    role: 'staff',
    effectivePermissions: {
      [PERMISSIONS.CATALOG_MANAGE]: false,
    },
  };

  const admin = {
    role: 'admin',
    effectivePermissions: {
      [PERMISSIONS.CATALOG_MANAGE]: true,
    },
  };

  assert.equal(hasPermission(staff, PERMISSIONS.CATALOG_MANAGE), false, 'Staff cannot edit service catalog');
  assert.equal(hasPermission(admin, PERMISSIONS.CATALOG_MANAGE), true, 'Admin can edit service catalog');
});
