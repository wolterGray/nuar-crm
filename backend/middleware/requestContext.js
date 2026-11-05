const {randomUUID} = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const getRequestId = (value, createId = randomUUID) => {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = typeof candidate === 'string' ? candidate.trim() : '';
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : createId();
};

const createRequestContext = ({createId = randomUUID} = {}) => (req, res, next) => {
  req.requestId = getRequestId(req.get?.('x-request-id'), createId);
  res.set('X-Request-Id', req.requestId);
  next();
};

module.exports = {
  REQUEST_ID_PATTERN,
  createRequestContext,
  getRequestId,
  requestContext: createRequestContext(),
};
