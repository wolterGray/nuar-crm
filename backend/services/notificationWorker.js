const {processDueWebPushDeliveries} = require('./businessPushService');
const {processDueSmsDeliveries} = require('./smsService');

let workerTimer = null;
let isWorkerRunning = false;
let lastWorkerRunAt = null;
let lastWorkerStatus = null;
let lastWorkerError = null;

const runWorkerCycle = async (prisma, options = {}) => {
  if (isWorkerRunning) {
    return {skipped: true, reason: 'already_running'};
  }
  isWorkerRunning = true;
  const startedAt = new Date();
  try {
    const limit = Number(options.limit) || 50;
    const [webPush, sms] = await Promise.allSettled([
      processDueWebPushDeliveries(prisma, {limit, sendNotification: options.sendNotification}),
      processDueSmsDeliveries({limit}),
    ]);

    lastWorkerRunAt = startedAt;
    lastWorkerStatus = {
      ok: webPush.status === 'fulfilled' && sms.status === 'fulfilled',
      sms: sms.status === 'fulfilled' ? sms.value : {error: sms.reason?.message},
      timestamp: startedAt.toISOString(),
      webPush: webPush.status === 'fulfilled' ? webPush.value : {error: webPush.reason?.message},
    };
    lastWorkerError = null;
    return lastWorkerStatus;
  } catch (err) {
    lastWorkerError = err.message || 'Worker cycle failed';
    lastWorkerStatus = {
      error: lastWorkerError,
      ok: false,
      timestamp: startedAt.toISOString(),
    };
    console.error('[notificationWorker] Execution error:', err);
    return lastWorkerStatus;
  } finally {
    isWorkerRunning = false;
  }
};

const startNotificationWorker = (prisma, {intervalMs = 20000} = {}) => {
  if (workerTimer) return;
  // Trigger initial run after 3 seconds
  const initialTimer = setTimeout(() => {
    runWorkerCycle(prisma).catch(() => {});
  }, 3000);
  if (typeof initialTimer.unref === 'function') initialTimer.unref();

  workerTimer = setInterval(() => {
    runWorkerCycle(prisma).catch(() => {});
  }, Math.max(5000, Number(intervalMs) || 20000));

  if (typeof workerTimer.unref === 'function') {
    workerTimer.unref();
  }
  console.log(`[notificationWorker] Started (polling every ${intervalMs}ms)`);
};

const stopNotificationWorker = () => {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[notificationWorker] Stopped');
  }
};

const getWorkerStatus = () => ({
  active: Boolean(workerTimer),
  isRunning: isWorkerRunning,
  lastError: lastWorkerError,
  lastRunAt: lastWorkerRunAt,
  lastStatus: lastWorkerStatus,
});

module.exports = {
  getWorkerStatus,
  runWorkerCycle,
  startNotificationWorker,
  stopNotificationWorker,
};
