// backend/middleware/errorHandler.js
const {prisma} = require('../services/prismaClient');
const {recordErrorEvent} = require('../services/loggingService');
const {getHttpErrorResponse} = require('../utils/httpErrors');

const createErrorHandler = ({
  logErrorEvent = recordErrorEvent,
  logger = console,
  prismaClient = prisma,
} = {}) => function errorHandler(err, req, res, _next) {
  const response = getHttpErrorResponse(err);
  logger.error('Backend request error:', err);

  const event = {
    context: {
      body: req.body,
      method: req.method,
      params: req.params,
      path: req.originalUrl,
      query: req.query,
    },
    error: err,
    message: response.message,
    severity: response.status >= 500 ? 'error' : 'warning',
    source: 'express',
  };

  res.status(response.status).json({
    success: false,
    error: response.message,
  });
  queueMicrotask(() => {
    Promise.resolve(logErrorEvent(prismaClient, event)).catch((loggingError) => {
      logger.error('Deferred ErrorEvent logging failed:', loggingError);
    });
  });
};

const errorHandler = createErrorHandler();

module.exports = errorHandler;
module.exports.createErrorHandler = createErrorHandler;
