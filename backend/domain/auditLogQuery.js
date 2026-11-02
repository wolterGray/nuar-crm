const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const cleanText = (value, maxLength = 120) =>
  String(value ?? '').trim().slice(0, maxLength);

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseDate = (value, endOfDay = false) => {
  const text = cleanText(value, 40);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

function parseAuditLogQuery(query = {}) {
  return {
    action: cleanText(query.action),
    actorId: cleanText(query.actorId),
    cursor: parsePositiveInt(query.cursor),
    dateFrom: parseDate(query.dateFrom),
    dateTo: parseDate(query.dateTo, true),
    entity: cleanText(query.entity),
    limit: Math.min(parsePositiveInt(query.limit) || DEFAULT_LIMIT, MAX_LIMIT),
    search: cleanText(query.search),
  };
}

function buildAuditLogWhere(filters) {
  const clauses = [];
  if (filters.cursor) clauses.push({id: {lt: filters.cursor}});
  if (filters.action) clauses.push({action: filters.action});
  if (filters.actorId) clauses.push({actorId: filters.actorId});
  if (filters.entity) clauses.push({entity: filters.entity});
  if (filters.dateFrom || filters.dateTo) {
    clauses.push({
      createdAt: {
        ...(filters.dateFrom ? {gte: filters.dateFrom} : {}),
        ...(filters.dateTo ? {lte: filters.dateTo} : {}),
      },
    });
  }
  if (filters.search) {
    clauses.push({
      OR: ['action', 'actorId', 'entity', 'entityId'].map((field) => ({
        [field]: {contains: filters.search, mode: 'insensitive'},
      })),
    });
  }
  return clauses.length ? {AND: clauses} : {};
}

module.exports = {
  buildAuditLogWhere,
  parseAuditLogQuery,
};
