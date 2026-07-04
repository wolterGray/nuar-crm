// backend/middleware/errorHandler.js
const {PrismaClient} = require('@prisma/client');
const {recordErrorEvent} = require('../services/loggingService');
const {getHttpErrorResponse} = require('../utils/httpErrors');

const prisma = new PrismaClient();

module.exports = async function errorHandler(err, req, res, next) {
  const response = getHttpErrorResponse(err);
  console.error('🔴 Error:', err);

  await recordErrorEvent(prisma, {
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
  });

  res.status(response.status).json({
    success: false,
    error: response.message,
  });
};
