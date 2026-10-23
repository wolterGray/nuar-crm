const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  findScopedClientIds,
  recordBelongsToEmployee,
  serviceIsAssignedToEmployee,
} = require('../utils/employeeScope');

const max = {id: 2, name: 'Max', services: null, payload: {}};

test('legacy records are assigned by master name when employeeId is absent', () => {
  assert.equal(recordBelongsToEmployee({employeeId: 2, payload: {}}, max), true);
  assert.equal(recordBelongsToEmployee({payload: {master: 'max'}}, max), true);
  assert.equal(recordBelongsToEmployee({payload: {master: 'Olha'}}, max), false);
});

test('scoped client ids include normalized and legacy visits without leaking coworkers', async () => {
  const prisma = {
    calendarEntry: {
      findMany: async () => [
        {payload: {clientId: 12, master: 'Max'}},
        {payload: {clientId: 99, master: 'Olha'}},
      ],
    },
    visit: {
      findMany: async () => [
        {clientId: 7, employeeId: 2, payload: {}},
        {clientId: 8, employeeId: null, payload: {master: 'Max'}},
        {clientId: 99, employeeId: null, payload: {master: 'Olha'}},
      ],
    },
  };

  assert.deepEqual((await findScopedClientIds(prisma, max)).sort((a, b) => a - b), [7, 8, 12]);
});

test('staff service visibility follows explicit CRM assignment', () => {
  assert.equal(serviceIsAssignedToEmployee({id: 5, payload: {assignedEmployeeIds: ['2']}}, max), true);
  assert.equal(serviceIsAssignedToEmployee({id: 6, payload: {assignedEmployeeNames: ['Olha']}}, max), false);
  assert.equal(serviceIsAssignedToEmployee({id: 7, payload: {}}, max), false);
});

test('explicit primary employeeId belonging to another master prevents primary name collision while preserving pair secondary master access', () => {
  assert.equal(
    recordBelongsToEmployee({employeeId: 99, payload: {master: 'Max'}}, max),
    false,
  );
  assert.equal(
    recordBelongsToEmployee({employeeId: 99, payload: {master: 'Olha', secondaryMaster: 'Max'}}, max),
    true,
  );
});

test('newly created clients by staff user are included in scoped client ids via AuditLog before first visit', async () => {
  const prisma = {
    auditLog: {
      findMany: async () => [{entityId: '55'}],
    },
    calendarEntry: {
      findMany: async () => [],
    },
    visit: {
      findMany: async () => [],
    },
  };

  const clientIds = await findScopedClientIds(prisma, max, {id: 5, sub: '5', email: 'max@nuarr.pl'});
  assert.deepEqual(clientIds, [55]);
});
