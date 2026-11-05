const normalizeFatalError = (cause) => {
  if (cause instanceof Error) return cause;
  if (typeof cause === 'string' && cause.trim()) return new Error(cause.trim());
  const safeCode = cause && typeof cause === 'object' && typeof cause.code === 'string'
    ? cause.code
    : 'Unknown fatal process error';
  return new Error(safeCode);
};

const createFatalErrorHandler = ({logger = console, shutdown}) => (source, cause) => {
  const error = normalizeFatalError(cause);
  logger.error(`[fatal] ${source}:`, error);
  shutdown(source, 1);
  return error;
};

module.exports = {createFatalErrorHandler, normalizeFatalError};
