const {redactSensitiveData} = require('../services/loggingService');

const truncate = (value, limit) => String(value ?? '').trim().slice(0, limit);

const normalizeClientErrorReport = (body = {}, auth = {}) => {
  const message = truncate(redactSensitiveData(body.message), 500);
  if (!message) return null;

  const stack = truncate(redactSensitiveData(body.stack), 4000);
  return {
    context: {
      actorId: String(auth.sub || auth.id || 'unknown'),
      componentStack: truncate(redactSensitiveData(body.componentStack), 4000),
      path: truncate(redactSensitiveData(body.path), 300),
      release: truncate(body.release, 100),
    },
    error: stack ? {message, stack} : null,
    message,
    source: 'frontend',
  };
};

module.exports = {normalizeClientErrorReport};
