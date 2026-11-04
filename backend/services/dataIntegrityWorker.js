const {checkDataIntegrity} = require('./dataIntegrityService');
const {recordErrorEvent} = require('./loggingService');

const DAY_MS = 24 * 60 * 60 * 1000;

let workerTimer = null;
let initialTimer = null;
let isRunning = false;
let lastError = null;
let lastResult = null;
let lastRunAt = null;

async function runDataIntegrityAudit(prisma, {now = new Date()} = {}) {
  const result = await checkDataIntegrity(prisma);
  if (!result.healthy) {
    await recordErrorEvent(prisma, {
      context: {checks: Object.fromEntries(Object.entries(result.checks).map(([key, value]) => [key, value.count]))},
      message: `CRM data integrity check found ${result.summary.criticalCount} critical issue(s)`,
      severity: 'error',
      source: 'data-integrity',
    });
  }
  return {...result, checkedAt: now.toISOString()};
}

function startDataIntegrityWorker(prisma, {env = process.env, intervalMs = DAY_MS} = {}) {
  if (workerTimer || String(env.DATA_INTEGRITY_CHECK_ENABLED || 'true').toLowerCase() === 'false') return;

  const execute = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      lastResult = await runDataIntegrityAudit(prisma);
      lastError = null;
      console.log(`[dataIntegrity] Completed; critical=${lastResult.summary.criticalCount}, warnings=${lastResult.summary.warningCount}`);
    } catch (error) {
      lastError = error.message || 'Data integrity check failed';
      console.error('[dataIntegrity] Failed:', error);
      await recordErrorEvent(prisma, {error, message: 'Automated CRM data integrity check failed', source: 'data-integrity-worker'});
    } finally {
      lastRunAt = new Date();
      isRunning = false;
    }
  };

  initialTimer = setTimeout(execute, 30000);
  if (typeof initialTimer.unref === 'function') initialTimer.unref();
  workerTimer = setInterval(execute, Math.max(60 * 60 * 1000, Number(intervalMs) || DAY_MS));
  if (typeof workerTimer.unref === 'function') workerTimer.unref();
  console.log(`[dataIntegrity] Started (checking every ${Math.max(60 * 60 * 1000, Number(intervalMs) || DAY_MS)}ms)`);
}

function stopDataIntegrityWorker() {
  if (workerTimer) clearInterval(workerTimer);
  if (initialTimer) clearTimeout(initialTimer);
  workerTimer = null;
  initialTimer = null;
}

const getDataIntegrityWorkerStatus = () => ({
  active: Boolean(workerTimer),
  isRunning,
  lastError,
  lastResult: lastResult ? {healthy: lastResult.healthy, summary: lastResult.summary} : null,
  lastRunAt,
});

module.exports = {
  getDataIntegrityWorkerStatus,
  runDataIntegrityAudit,
  startDataIntegrityWorker,
  stopDataIntegrityWorker,
};
