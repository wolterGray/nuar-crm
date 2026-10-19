const cleanIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown-ip';
};

/**
 * Creates an in-memory sliding window rate limiter middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Window duration in milliseconds (default: 60,000)
 * @param {number} options.max - Maximum requests allowed per window (default: 60)
 * @param {string} options.message - Error message when rate limited
 * @param {Function} options.keyGenerator - Function generating client identifier
 * @param {boolean} options.skipSuccessful - Optional flag to only count failures
 */
const createRateLimiter = ({
  keyGenerator = cleanIp,
  max = 60,
  message = 'Слишком много запросов. Пожалуйста, подождите.',
  windowMs = 60 * 1000,
} = {}) => {
  const hits = new Map();

  // Periodic cleanup of expired records every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 2 * 60 * 1000);

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  const rateLimiter = (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    if (typeof res.setHeader === 'function') {
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    }

    if (record.count > max) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', retryAfterSec);
      }
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSec,
        success: false,
      });
    }

    next();
  };

  rateLimiter._hits = hits;
  rateLimiter._cleanupInterval = cleanupInterval;
  rateLimiter.reset = () => hits.clear();

  return rateLimiter;
};

// Preset limiters for key routes
const authLoginLimiter = createRateLimiter({
  max: 10,
  message: 'Слишком много попыток входа с этого IP. Пожалуйста, подождите 1 минуту.',
  windowMs: 60 * 1000,
});

const passwordResetLimiter = createRateLimiter({
  max: 5,
  message: 'Слишком много запросов на сброс пароля. Подождите 15 минут перед следующей попыткой.',
  windowMs: 15 * 60 * 1000,
});

const publicBookingLimiter = createRateLimiter({
  max: 12,
  message: 'Слишком много заявок на бронирование. Пожалуйста, подождите 5 минут.',
  windowMs: 5 * 60 * 1000,
});

const publicApiLimiter = createRateLimiter({
  max: 120,
  message: 'Превышен лимит запросов к публичному API.',
  windowMs: 60 * 1000,
});

module.exports = {
  authLoginLimiter,
  cleanIp,
  createRateLimiter,
  passwordResetLimiter,
  publicApiLimiter,
  publicBookingLimiter,
};
