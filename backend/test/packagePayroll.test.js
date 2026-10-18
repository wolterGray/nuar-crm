const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  buildEmployeeEarningSnapshots,
  buildPackageSaleEarningSnapshot,
  isCompletedEarningEligibleVisit,
} = require('../services/employeeEarningsService');

test('package visit never creates a massage earning', async () => {
  const visit = {
    id: 91,
    payload: {
      master: 'Max',
      packageUsageId: 12,
      payment: 'Пакет',
      status: 'completed',
    },
  };

  assert.equal(isCompletedEarningEligibleVisit(visit.payload), false);
  assert.deepEqual(await buildEmployeeEarningSnapshots({}, visit), []);
});

test('package sale creates one commission for its seller', async () => {
  const employee = {commissionRate: 40, id: 7, name: 'Max'};
  const tx = {
    employee: {
      findUnique: async ({where}) => where.id === employee.id ? employee : null,
    },
  };
  const snapshot = await buildPackageSaleEarningSnapshot(tx, {
    employeeId: employee.id,
    id: 12,
    price: 1000,
  });

  assert.equal(snapshot.employeeId, employee.id);
  assert.equal(String(snapshot.actualPrice), '1000');
  assert.equal(String(snapshot.commissionPercent), '40');
  assert.equal(String(snapshot.amount), '400');
  assert.equal(snapshot.sourceType, 'PACKAGE_SALE');
});
