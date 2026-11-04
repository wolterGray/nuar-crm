const assert = require('node:assert/strict');
const test = require('node:test');
const {checkDataIntegrity, findSiteBookingLifecycleMismatches} = require('../services/dataIntegrityService');

const createPrisma = ({calendarEntries = [], certificates = [], packages = [], visits = []} = {}) => ({
  calendarEntry: {findMany: async () => calendarEntries},
  certificate: {findMany: async () => certificates},
  clientPackage: {findMany: async () => packages},
  visit: {findMany: async () => visits},
});

test('data integrity reports a healthy consistent CRM snapshot', async () => {
  const result = await checkDataIntegrity(createPrisma({
    calendarEntries: [{id: 10, status: 'completed', visitId: 20}],
    certificates: [{id: 1, nominal: 500, remainingBalance: 200}],
    packages: [{id: 1, remainingVisits: 3, totalVisits: 6}],
    visits: [{id: 20, calendarEntryId: 10}],
  }));

  assert.equal(result.healthy, true);
  assert.deepEqual(result.summary, {criticalCount: 0, warningCount: 0});
});

test('data integrity distinguishes a missing visit from an existing visit with a broken reverse link', async () => {
  const result = await checkDataIntegrity(createPrisma({
    calendarEntries: [{id: 10, status: 'scheduled', visitId: 20}],
    visits: [{id: 20, calendarEntryId: null}],
  }));

  assert.equal(result.checks.missingVisits.count, 0);
  assert.equal(result.checks.mismatchedVisitLinks.count, 1);
  assert.equal(result.checks.mismatchedVisitLinks.samples[0].direction, 'calendar_to_visit');
});

test('data integrity detects duplicate, broken, mismatched and invalid financial links', async () => {
  const result = await checkDataIntegrity(createPrisma({
    calendarEntries: [
      {id: 10, status: 'completed', visitId: 21},
      {id: 12, status: 'completed', visitId: 99},
      {id: 13, status: 'completed', visitId: null},
    ],
    certificates: [{id: 2, nominal: 500, remainingBalance: 600}],
    packages: [{id: 2, remainingVisits: -1, totalVisits: 6}],
    visits: [
      {id: 20, calendarEntryId: 10},
      {id: 21, calendarEntryId: 10},
      {id: 22, calendarEntryId: 11},
    ],
  }));

  assert.equal(result.healthy, false);
  assert.equal(result.checks.duplicateVisitLinks.count, 1);
  assert.equal(result.checks.completedEntriesWithoutVisit.count, 1);
  assert.equal(result.checks.mismatchedVisitLinks.count, 1);
  assert.equal(result.checks.missingCalendarEntries.count, 1);
  assert.equal(result.checks.missingVisits.count, 1);
  assert.equal(result.summary.criticalCount, 5);
  assert.equal(result.summary.warningCount, 2);
});

test('data integrity detects inconsistent site booking lifecycle links', () => {
  const mismatches = findSiteBookingLifecycleMismatches([
    {eventId: 7, eventStatus: 'new', requestId: 'a', requestStatus: 'pending', waitlistId: 2, waitlistStatus: 'deleted'},
    {eventId: 8, eventStatus: 'new', requestId: 'b', requestStatus: 'rejected', waitlistId: 3, waitlistStatus: 'active'},
    {eventId: 9, eventStatus: 'resolved', requestId: 'c', requestStatus: 'rejected', waitlistId: 4, waitlistStatus: 'closed'},
    {eventId: null, eventStatus: null, requestId: 'd', requestStatus: 'pending', waitlistId: null, waitlistStatus: null},
  ]);

  assert.equal(mismatches.length, 3);
  assert.deepEqual(mismatches[0].reasons, ['pending_request_with_closed_waitlist']);
  assert.deepEqual(mismatches[1].reasons, [
    'terminal_request_with_active_waitlist',
    'terminal_request_with_active_notification',
  ]);
  assert.deepEqual(mismatches[2].reasons, ['missing_waitlist', 'missing_notification']);
});
