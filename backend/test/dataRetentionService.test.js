const test = require('node:test');
const assert = require('node:assert/strict');
const {getRetentionPolicy, runDataRetention} = require('../services/dataRetentionService');

const model = (count, calls, name) => ({
  deleteMany: async (args) => {
    calls[name] = args;
    return {count};
  },
});

test('retention policy uses conservative defaults and validates overrides', () => {
  assert.deepEqual(getRetentionPolicy({}), {
    auditLogDays: 730,
    errorEventDays: 90,
    integrationJobDays: 90,
    notificationDays: 180,
    resetTokenDays: 30,
  });
  assert.equal(getRetentionPolicy({RETENTION_AUDIT_LOG_DAYS: '365'}).auditLogDays, 365);
  assert.equal(getRetentionPolicy({RETENTION_ERROR_EVENT_DAYS: '0'}).errorEventDays, 90);
});

test('retention removes only expired technical records', async () => {
  const calls = {};
  const prisma = {
    auditLog: model(1, calls, 'auditLog'),
    errorEvent: model(2, calls, 'errorEvent'),
    integrationJob: model(3, calls, 'integrationJob'),
    notificationDelivery: model(4, calls, 'notificationDelivery'),
    notificationEvent: model(5, calls, 'notificationEvent'),
    passwordResetToken: model(6, calls, 'passwordResetToken'),
  };
  const result = await runDataRetention(prisma, {now: new Date('2026-11-03T12:00:00.000Z')});

  assert.equal(result.totalDeleted, 21);
  assert.deepEqual(calls.notificationDelivery.where.status.in, ['failed', 'sent']);
  assert.deepEqual(calls.integrationJob.where.status.in, ['completed', 'failed']);
  assert.equal(calls.auditLog.where.createdAt.lt.toISOString(), '2024-11-03T12:00:00.000Z');
  assert.ok(calls.passwordResetToken.where.OR[0].expiresAt.lt instanceof Date);
});
