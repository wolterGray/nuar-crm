const assert = require('node:assert/strict');
const test = require('node:test');
const {runDataIntegrityAudit} = require('../services/dataIntegrityWorker');

const createPrisma = ({calendarEntries = [], siteBookingRows = [], visits = []} = {}) => {
  const errors = [];
  return {
    $queryRaw: async () => siteBookingRows,
    calendarEntry: {findMany: async () => calendarEntries},
    certificate: {findMany: async () => []},
    clientPackage: {findMany: async () => []},
    errorEvent: {create: async ({data}) => { errors.push(data); return data; }},
    errors,
    visit: {findMany: async () => visits},
  };
};

test('automated data integrity audit stays quiet for healthy data', async () => {
  const prisma = createPrisma({
    calendarEntries: [{id: 1, status: 'completed', visitId: 2}],
    visits: [{id: 2, calendarEntryId: 1}],
  });

  const result = await runDataIntegrityAudit(prisma, {now: new Date('2026-11-04T08:00:00Z')});

  assert.equal(result.healthy, true);
  assert.equal(result.checkedAt, '2026-11-04T08:00:00.000Z');
  assert.equal(prisma.errors.length, 0);
});

test('automated data integrity audit records critical results without changing CRM data', async () => {
  const prisma = createPrisma({
    calendarEntries: [{id: 1, status: 'completed', visitId: null}],
  });

  const result = await runDataIntegrityAudit(prisma);

  assert.equal(result.healthy, false);
  assert.equal(prisma.errors.length, 1);
  assert.equal(prisma.errors[0].source, 'data-integrity');
  assert.equal(prisma.errors[0].severity, 'error');
  assert.equal(prisma.errors[0].context.checks.completedEntriesWithoutVisit, 1);
});

test('automated data integrity audit reports lifecycle warnings without marking data unhealthy', async () => {
  const prisma = createPrisma({
    calendarEntries: [{id: 1, status: 'completed', visitId: 2}],
    siteBookingRows: [{
      eventId: 7,
      eventStatus: 'new',
      requestId: 'booking-1',
      requestStatus: 'rejected',
      waitlistId: 3,
      waitlistStatus: 'active',
    }],
    visits: [{id: 2, calendarEntryId: 1}],
  });

  const result = await runDataIntegrityAudit(prisma);

  assert.equal(result.healthy, true);
  assert.equal(result.summary.warningCount, 1);
  assert.equal(prisma.errors.length, 1);
  assert.equal(prisma.errors[0].severity, 'warning');
  assert.match(prisma.errors[0].message, /0 critical issue\(s\) and 1 warning\(s\)/);
  assert.equal(prisma.errors[0].context.checks.siteBookingLifecycleMismatches, 1);
});
