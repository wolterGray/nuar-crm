const test = require('node:test');
const assert = require('node:assert/strict');
const {checkReadiness} = require('../services/readinessService');

test('readiness succeeds only when database and worker are healthy', async () => {
  const result = await checkReadiness({
    prisma: {$queryRawUnsafe: async () => [{one: 1}]},
    getWorkerStatus: () => ({active: true, lastError: null, lastRunAt: new Date('2026-11-02T10:00:00Z')}),
  });
  assert.equal(result.ready, true);
  assert.equal(result.checks.database.ok, true);
  assert.equal(result.checks.notificationWorker.ok, true);
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
