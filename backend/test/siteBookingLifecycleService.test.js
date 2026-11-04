const test = require('node:test');
const assert = require('node:assert/strict');
const {syncSiteBookingFromWaitlistStatus} = require('../services/siteBookingLifecycleService');

const createTx = () => {
  const calls = {events: [], recipients: [], sql: []};
  return {
    calls,
    tx: {
      $executeRaw: async (strings, ...values) => {
        calls.sql.push({query: strings.join('?'), values});
        return 1;
      },
      notificationEvent: {
        findMany: async () => [{id: 17}],
        updateMany: async (args) => { calls.events.push(args); },
      },
      notificationRecipient: {
        updateMany: async (args) => { calls.recipients.push(args); },
      },
    },
  };
};

test('deleting a site waitlist entry rejects its request and resolves notifications', async () => {
  const {calls, tx} = createTx();
  const now = new Date('2026-11-04T16:30:00.000Z');

  await syncSiteBookingFromWaitlistStatus(tx, 'booking-1', {deleted: true, now});

  assert.deepEqual(calls.sql[0].values, ['rejected', 'booking-1']);
  assert.equal(calls.events[0].data.status, 'resolved');
  assert.equal(calls.events[0].data.resolvedAt, now);
  assert.deepEqual(calls.recipients[0].where.notificationEventId.in, [17]);
});

test('restoring a site waitlist entry reopens its request and notifications', async () => {
  const {calls, tx} = createTx();

  await syncSiteBookingFromWaitlistStatus(tx, 'booking-1', {deleted: false});

  assert.deepEqual(calls.sql[0].values, ['pending', 'booking-1']);
  assert.equal(calls.events[0].data.status, 'new');
  assert.equal(calls.events[0].data.resolvedAt, null);
  assert.equal(calls.recipients[0].data.status, 'new');
});

test('ordinary waitlist entries do not touch site booking state', async () => {
  const {calls, tx} = createTx();

  await syncSiteBookingFromWaitlistStatus(tx, '', {deleted: true});

  assert.equal(calls.sql.length, 0);
  assert.equal(calls.events.length, 0);
});
