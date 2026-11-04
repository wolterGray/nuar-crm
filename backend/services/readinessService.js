const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Database readiness check timed out')), timeoutMs);
  Promise.resolve(promise).then(
    (value) => { clearTimeout(timeout); resolve(value); },
    (error) => { clearTimeout(timeout); reject(error); },
  );
});

const workerCheck = (status, fallbackError) => {
  const error = status?.lastError || null;
  return {
    ok: Boolean(status?.active) && !error,
    active: Boolean(status?.active),
    lastRunAt: status?.lastRunAt || null,
    ...(error ? {error} : !status?.active ? {error: fallbackError} : {}),
  };
};

async function checkReadiness({
  getBackupStatus,
  getDataIntegrityWorkerStatus,
  getDataRetentionStatus,
  getWorkerStatus,
  prisma,
  timeoutMs = 2000,
}) {
  const checks = {
    database: {ok: false},
    notificationWorker: {ok: false},
  };

  try {
    await withTimeout(prisma.$queryRawUnsafe('SELECT 1'), timeoutMs);
    checks.database = {ok: true};
  } catch (error) {
    checks.database = {ok: false, error: error.message || 'Database unavailable'};
  }

  const worker = getWorkerStatus();
  const workerError = worker?.lastError || (worker?.lastStatus?.ok === false ? 'Last worker cycle failed' : null);
  checks.notificationWorker = {
    ok: Boolean(worker?.active) && !workerError,
    active: Boolean(worker?.active),
    lastRunAt: worker?.lastRunAt || null,
    ...(workerError ? {error: workerError} : {}),
  };

  if (getDataIntegrityWorkerStatus) {
    checks.dataIntegrityWorker = workerCheck(
      getDataIntegrityWorkerStatus(),
      'Data integrity worker is inactive',
    );
  }
  if (getDataRetentionStatus) {
    checks.dataRetentionWorker = workerCheck(
      getDataRetentionStatus(),
      'Data retention worker is inactive',
    );
  }
  if (getBackupStatus) {
    try {
      const backup = getBackupStatus();
      checks.backup = {
        ok: backup?.healthy === true,
        latestAt: backup?.latest?.createdAt || null,
        mirrorConfigured: backup?.mirror?.configured === true,
        mirrorOk: backup?.mirror?.configured === true ? backup?.mirror?.healthy === true : null,
        ...(backup?.healthy === true ? {} : {error: 'Database backup is missing, stale, or invalid'}),
      };
    } catch (error) {
      checks.backup = {ok: false, error: error.message || 'Backup status unavailable'};
    }
  }

  return {
    checks,
    ready: Object.values(checks).every((check) => check.ok),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {checkReadiness};
