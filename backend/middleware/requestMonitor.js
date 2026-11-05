const normalizeThreshold = (value, fallback = 2000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const requestPath = (req) => String(req.originalUrl || req.url || '').split('?')[0];

const createRequestMonitor = ({
  logger = console,
  now = Date.now,
  slowRequestMs = normalizeThreshold(process.env.SLOW_REQUEST_MS),
} = {}) => (req, res, next) => {
  const startedAt = now();

  res.once('finish', () => {
    const durationMs = Math.max(0, now() - startedAt);
    const status = Number(res.statusCode) || 0;
    const details = {
      durationMs,
      method: req.method,
      path: requestPath(req),
      requestId: req.requestId || null,
      status,
    };

    if (status >= 500) {
      logger.error('Backend request failed:', details);
    } else if (durationMs >= slowRequestMs) {
      logger.warn('Slow backend request:', details);
    }
  });

  next();
};

module.exports = {
  createRequestMonitor,
  normalizeThreshold,
  requestMonitor: createRequestMonitor(),
  requestPath,
};
