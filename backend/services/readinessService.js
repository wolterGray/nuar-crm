const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Database readiness check timed out')), timeoutMs);
  Promise.resolve(promise).then(
    (value) => { clearTimeout(timeout); resolve(value); },
    (error) => { clearTimeout(timeout); reject(error); },
  );
});

async function checkReadiness({getWorkerStatus, prisma, timeoutMs = 2000}) {
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

  return {
    checks,
    ready: Object.values(checks).every((check) => check.ok),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {checkReadiness};
