const safeJson = (value) => {
  if (value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {unserializable: String(value)};
  }
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
        context: safeJson(context),
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
  recordAuditLog,
  recordErrorEvent,
};
