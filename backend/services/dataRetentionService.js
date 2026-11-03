const DAY_MS = 24 * 60 * 60 * 1000;

let retentionTimer = null;
let retentionInitialTimer = null;
let lastRunAt = null;
let lastResult = null;
let lastError = null;

const readDays = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
};

const getRetentionPolicy = (env = process.env) => ({
  auditLogDays: readDays(env.RETENTION_AUDIT_LOG_DAYS, 730),
  authSessionDays: readDays(env.RETENTION_AUTH_SESSION_DAYS, 30),
  errorEventDays: readDays(env.RETENTION_ERROR_EVENT_DAYS, 90),
  integrationJobDays: readDays(env.RETENTION_INTEGRATION_JOB_DAYS, 90),
  notificationDays: readDays(env.RETENTION_NOTIFICATION_DAYS, 180),
  resetTokenDays: readDays(env.RETENTION_RESET_TOKEN_DAYS, 30),
});

const cutoff = (now, days) => new Date(now.getTime() - days * DAY_MS);

async function runDataRetention(prisma, {env = process.env, now = new Date()} = {}) {
  const policy = getRetentionPolicy(env);
  const [auditLogs, authSessions, errorEvents, deliveries, notificationEvents, resetTokens, integrationJobs] = await Promise.all([
    prisma.auditLog.deleteMany({where: {createdAt: {lt: cutoff(now, policy.auditLogDays)}}}),
    prisma.authSession.deleteMany({
      where: {
        OR: [
          {expiresAt: {lt: now}},
          {revokedAt: {lt: cutoff(now, policy.authSessionDays)}},
        ],
      },
    }),
    prisma.errorEvent.deleteMany({where: {createdAt: {lt: cutoff(now, policy.errorEventDays)}}}),
    prisma.notificationDelivery.deleteMany({
      where: {
        status: {in: ['failed', 'sent']},
        updatedAt: {lt: cutoff(now, policy.notificationDays)},
      },
    }),
    prisma.notificationEvent.deleteMany({
      where: {resolvedAt: {lt: cutoff(now, policy.notificationDays)}},
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          {expiresAt: {lt: cutoff(now, policy.resetTokenDays)}},
          {usedAt: {lt: cutoff(now, policy.resetTokenDays)}},
        ],
      },
    }),
    prisma.integrationJob.deleteMany({
      where: {
        status: {in: ['completed', 'failed']},
        updatedAt: {lt: cutoff(now, policy.integrationJobDays)},
      },
    }),
  ]);

  const deleted = {
    auditLogs: auditLogs.count,
    authSessions: authSessions.count,
    deliveries: deliveries.count,
    errorEvents: errorEvents.count,
    integrationJobs: integrationJobs.count,
    notificationEvents: notificationEvents.count,
    resetTokens: resetTokens.count,
  };
  return {deleted, policy, totalDeleted: Object.values(deleted).reduce((sum, count) => sum + count, 0)};
}

const startDataRetentionWorker = (prisma, {env = process.env, intervalMs = DAY_MS} = {}) => {
  if (retentionTimer || String(env.DATA_RETENTION_ENABLED || 'true').toLowerCase() === 'false') return;

  const execute = async () => {
    try {
      lastResult = await runDataRetention(prisma, {env});
      lastRunAt = new Date();
      lastError = null;
      console.log(`[dataRetention] Completed; deleted ${lastResult.totalDeleted} expired technical records`);
    } catch (error) {
      lastRunAt = new Date();
      lastError = error.message || 'Data retention failed';
      console.error('[dataRetention] Failed:', error);
    }
  };

  retentionInitialTimer = setTimeout(execute, 15000);
  if (typeof retentionInitialTimer.unref === 'function') retentionInitialTimer.unref();
  retentionTimer = setInterval(execute, Math.max(60 * 60 * 1000, Number(intervalMs) || DAY_MS));
  if (typeof retentionTimer.unref === 'function') retentionTimer.unref();
};

const stopDataRetentionWorker = () => {
  if (retentionTimer) clearInterval(retentionTimer);
  if (retentionInitialTimer) clearTimeout(retentionInitialTimer);
  retentionTimer = null;
  retentionInitialTimer = null;
};

const getDataRetentionStatus = () => ({
  active: Boolean(retentionTimer),
  lastError,
  lastResult,
  lastRunAt,
});

module.exports = {
  getDataRetentionStatus,
  getRetentionPolicy,
  runDataRetention,
  startDataRetentionWorker,
  stopDataRetentionWorker,
};
