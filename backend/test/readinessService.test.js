const test = require('node:test');
const assert = require('node:assert/strict');
const {checkReadiness} = require('../services/readinessService');

test('readiness succeeds only when database and worker are healthy', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => [{one: 1}]},
    getDataIntegrityWorkerStatus: () => ({active: true, lastError: null}),
    getDataRetentionStatus: () => ({active: true, lastError: null}),
    getWorkerStatus: () => ({active: true, lastError: null, lastRunAt: new Date('2026-11-02T10:00:00Z')}),
  });
  assert.equal(result.ready, true);
  assert.equal(result.checks.database.ok, true);
  assert.equal(result.checks.notificationWorker.ok, true);
  assert.equal(result.checks.dataIntegrityWorker.ok, true);
  assert.equal(result.checks.dataRetentionWorker.ok, true);
});

test('readiness reports inactive or failed maintenance workers', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => [{one: 1}]},
    getDataIntegrityWorkerStatus: () => ({active: false}),
    getDataRetentionStatus: () => ({active: true, lastError: 'cleanup failed'}),
    getWorkerStatus: () => ({active: true}),
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.dataIntegrityWorker.error, 'Data integrity worker is inactive');
  assert.equal(result.checks.dataRetentionWorker.error, 'cleanup failed');
});

test('readiness fails closed when database is unavailable', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => { throw new Error('connection refused'); }},
    getWorkerStatus: () => ({active: true}),
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.database.error, 'connection refused');
});

test('readiness reports an inactive notification worker', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => [{one: 1}]},
    getWorkerStatus: () => ({active: false}),
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.notificationWorker.ok, false);
});

test('readiness reports a failed worker cycle even when the timer is active', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => [{one: 1}]},
    getWorkerStatus: () => ({active: true, lastStatus: {ok: false}}),
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.notificationWorker.error, 'Last worker cycle failed');
});
