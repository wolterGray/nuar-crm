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
