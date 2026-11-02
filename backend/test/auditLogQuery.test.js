const test = require('node:test');
const assert = require('node:assert/strict');
const {buildAuditLogWhere, parseAuditLogQuery} = require('../domain/auditLogQuery');

test('audit log query clamps pagination and rejects invalid cursors', () => {
  assert.equal(parseAuditLogQuery({limit: '500', cursor: '-1'}).limit, 100);
  assert.equal(parseAuditLogQuery({limit: '500', cursor: '-1'}).cursor, null);
  assert.equal(parseAuditLogQuery({}).limit, 40);
});

test('audit log query builds exact filters and text search', () => {
  const filters = parseAuditLogQuery({
    action: 'visit.update',
    actorId: '7',
    cursor: '91',
    entity: 'visit',
    search: 'anna',
  });
  const where = buildAuditLogWhere(filters);
  assert.deepEqual(where.AND.slice(0, 4), [
    {id: {lt: 91}},
    {action: 'visit.update'},
    {actorId: '7'},
    {entity: 'visit'},
  ]);
  assert.equal(where.AND[4].OR.length, 4);
});

test('audit log date-only upper bound includes the whole UTC day', () => {
  const filters = parseAuditLogQuery({dateTo: '2026-11-02'});
  assert.equal(filters.dateTo.toISOString(), '2026-11-02T23:59:59.999Z');
});
