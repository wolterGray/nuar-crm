const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  buildEmployeeEarningSnapshots,
  buildPackageSaleEarningSnapshot,
  isCompletedEarningEligibleVisit,
} = require('../services/employeeEarningsService');
const {buildServerPayrollReport} = require('../utils/financeHelpers');

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

test('payroll summary pays package sale but not package massage', () => {
  const report = buildServerPayrollReport({
    clientPackages: [{
      id: 11,
      employeeId: 2,
      price: 1000,
      purchaseDate: '2026-10-02',
      payload: {master: 'Max', commissionRate: 40},
    }],
    employeeId: 2,
    employees: [{id: 2, name: 'Max', commissionRate: 40, payload: {}}],
    endDate: '2026-10-31',
    startDate: '2026-10-01',
    visits: [{
      id: 21,
      payload: {
        amount: 250,
        client: 'Client',
        date: '2026-10-03',
        master: 'Max',
        packageUsageId: 11,
        payment: 'Пакет',
        status: 'completed',
      },
    }],
  });

  assert.equal(report.totals.packageVisitPayout, 0);
  assert.equal(report.totals.servicePayout, 0);
  assert.equal(report.totals.packageSalePayout, 400);
  assert.equal(report.totals.totalPayout, 400);
});
