const safeJson = (value) => {
  if (value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {unserializable: String(value)};
  }
};

const SENSITIVE_KEY_PATTERN = /(^|_)(authorization|cookie|password|passcode|secret|token|access.?token|refresh.?token|p256dh|auth|phone|email|address)($|_)/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

const redactSensitiveData = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.replace(BEARER_PATTERN, 'Bearer [REDACTED]').slice(0, 2000);
  }
  if (typeof value !== 'object') return value;
  if (depth >= 6) return '[TRUNCATED]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactSensitiveData(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).slice(0, 100).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : redactSensitiveData(item, depth + 1, seen),
    ])
  );
};

const getActorId = (req) =>
  String(req?.auth?.sub || req?.auth?.id || req?.auth?.email || 'unknown');

async function recordErrorEvent(prisma, {
  context = null,
  error = null,
  message = '',
  severity = 'error',
  source = 'backend',
} = {}) {
  try {
    await prisma.errorEvent.create({
      data: {
        context: safeJson(redactSensitiveData(context)),
        message: String(message || error?.message || 'Unknown error'),
        severity,
        source,
        stack: error?.stack ? String(error.stack) : null,
      },
    });
  } catch (logError) {
    console.error('ErrorEvent logging failed:', logError);
  }
}

async function recordAuditLog(prisma, req, {
  action,
  after = null,
  before = null,
  entity,
  entityId = null,
} = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: String(action),
        actorId: getActorId(req),
        after: safeJson(after),
        before: safeJson(before),
        entity: String(entity),
        entityId: entityId === null || entityId === undefined ? null : String(entityId),
        ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (error) {
    await recordErrorEvent(prisma, {
      context: {action, entity, entityId},
      error,
      message: 'AuditLog write failed',
      source: 'audit',
    });
  }
}

module.exports = {
  redactSensitiveData,
  recordAuditLog,
  recordErrorEvent,
};
