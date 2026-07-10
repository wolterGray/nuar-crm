const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('./httpErrors');

const respond = (res, promise) => {
  promise
    .then((data) => res.json({ success: true, data }))
    .catch((err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const respondWithAudit = (prisma, req, res, promise, audit, onCalendarEntryChange = null) => {
  promise
    .then(async (data) => {
      await recordAuditLog(prisma, req, {
        ...audit,
        after: audit?.after === undefined ? data : audit.after,
        entityId: audit?.entityId ?? data?.id,
      });
      
      if (audit?.entity === 'CalendarEntry' && onCalendarEntryChange) {
        const before = audit.before;
        const after = audit?.after === undefined ? data : audit.after;
        await onCalendarEntryChange(before, after, audit.action, req);
      }

      res.json({ success: true, data });
    })
    .catch(async (err) => {
      const response = getHttpErrorResponse(err);
      console.error('CRUD error:', err);
      await recordErrorEvent(prisma, {
        context: {
          action: audit?.action,
          entity: audit?.entity,
          params: req.params,
        },
        error: err,
        message: err.message,
        source: 'crud',
      });
      res.status(response.status).json({ success: false, error: response.message });
    });
};

const findById = (prisma, model, id) => prisma[model].findUnique({ where: { id } });

const auditCreate = (prisma, req, res, promise, entity, action) =>
  respondWithAudit(prisma, req, res, promise, { action, entity });

const auditUpdate = async (prisma, req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(prisma, model, id) : null;
  respondWithAudit(prisma, req, res, promise, { action, before, entity, entityId: id });
};

const auditDelete = async (prisma, req, res, model, id, promise, entity, action) => {
  const before = Number.isFinite(id) ? await findById(prisma, model, id) : null;
  respondWithAudit(prisma, req, res, promise, {
    action,
    after: null,
    before,
    entity,
    entityId: id,
  });
};

const clientSelect = {
  id: true,
  name: true,
  messageName: true,
  phone: true,
  email: true,
  birthday: true,
  instagram: true,
  telegram: true,
  source: true,
  messageLanguage: true,
  preference: true,
  status: true,
  tags: true,
  note: true,
  createdAt: true,
  updatedAt: true,
};

const cleanOptionalString = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

const validationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const assertNonNegative = (value, fieldName) => {
  if (value !== null && value !== undefined && Number(value) < 0) {
    throw validationError(`${fieldName} cannot be negative`);
  }
};

const sendValidationError = (res, err) => {
  const response = getHttpErrorResponse(err);
  return res.status(response.status).json({ success: false, error: response.message });
};

const parsePositiveInt = (value, fieldName = 'id') => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw validationError(`${fieldName} is invalid`);
  }
  return number;
};

const getRouteId = (req, res, fieldName = 'id') => {
  try {
    return parsePositiveInt(req.params[fieldName], fieldName);
  } catch (err) {
    sendValidationError(res, err);
    return null;
  }
};

const withStoredId = (record) => {
  if (!record) return record;
  return record;
};

const LEGACY_FINANCIAL_WRITE_FLAG = 'allowLegacyFinancialWrite';

const warnLegacyFinancialWrite = async (prisma, req, { action, entity, sourceOfTruth }) => {
  const allowed = req.body?.[LEGACY_FINANCIAL_WRITE_FLAG] === true;
  const warning = `Legacy financial endpoint called: ${req.method} ${req.originalUrl}. Use ${sourceOfTruth}.`;

  console.warn(warning, { allowed, action });
  await recordAuditLog(prisma, req, {
    action: 'legacy financial write attempted',
    after: {
      action,
      allowed,
      method: req.method,
      path: req.originalUrl,
      sourceOfTruth,
    },
    before: null,
    entity,
    entityId: null,
  });
};

const requireLegacyFinancialWriteFlag = async (prisma, req, res, options) => {
  await warnLegacyFinancialWrite(prisma, req, options);

  if (req.body?.[LEGACY_FINANCIAL_WRITE_FLAG] === true) {
    return true;
  }

  return res.status(422).json({
    success: false,
    error: `Legacy financial write is disabled. Use ${options.sourceOfTruth}.`,
  });
};

module.exports = {
  respond,
  respondWithAudit,
  findById,
  auditCreate,
  auditUpdate,
  auditDelete,
  clientSelect,
  cleanOptionalString,
  validationError,
  assertNonNegative,
  sendValidationError,
  parsePositiveInt,
  getRouteId,
  withStoredId,
  requireLegacyFinancialWriteFlag,
};
