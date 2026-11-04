const {processDueWebPushDeliveries} = require('./businessPushService');
const {processDueSmsDeliveries} = require('./smsService');

let workerTimer = null;
let initialTimer = null;
let isWorkerRunning = false;
let activeWorkerCycle = null;
let lastWorkerRunAt = null;
let lastWorkerStatus = null;
let lastWorkerError = null;

const runWorkerCycle = (prisma, options = {}) => {
  if (isWorkerRunning) {
    return Promise.resolve({skipped: true, reason: 'already_running'});
  }
  isWorkerRunning = true;
  activeWorkerCycle = (async () => {
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
      lastWorkerStatus = {error: lastWorkerError, ok: false, timestamp: startedAt.toISOString()};
      console.error('[notificationWorker] Execution error:', err);
      return lastWorkerStatus;
    } finally {
      isWorkerRunning = false;
      activeWorkerCycle = null;
    }
  })();
  return activeWorkerCycle;
};

const startNotificationWorker = (prisma, {intervalMs = 20000} = {}) => {
  if (workerTimer) return;
  // Trigger initial run after 3 seconds
  initialTimer = setTimeout(() => {
    initialTimer = null;
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

const stopNotificationWorker = async () => {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[notificationWorker] Stopped');
  }
  if (activeWorkerCycle) await activeWorkerCycle;
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
