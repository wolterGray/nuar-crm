const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { _test } = require('../routes/siteBooking');

const employees = [
  { name: 'Olha' },
  { name: 'Max' },
];

describe('site booking availability master isolation', () => {
  it('acquires the transaction lock without returning PostgreSQL void to Prisma', async () => {
    let query = '';
    let values = [];
    const tx = {
      $queryRaw: async (strings, ...params) => {
        query = strings.join('?');
        values = params;
        return [{locked: 1}];
      },
    };

    const result = await _test.acquireBookingLock(tx, 'site-booking:2026-11-04:olha');

    assert.match(query, /select 1::integer as locked/i);
    assert.match(query, /from pg_advisory_xact_lock/i);
    assert.doesNotMatch(query, /select\s+pg_advisory_xact_lock/i);
    assert.deepEqual(values, ['site-booking:2026-11-04:olha']);
    assert.deepEqual(result, [{locked: 1}]);
  });

  it('uses one transaction lock key for equivalent master labels', () => {
    assert.equal(
      _test.buildBookingLockKey('2026-10-25', ' Olha '),
      _test.buildBookingLockKey('2026-10-25', 'olha'),
    );
    assert.notEqual(
      _test.buildBookingLockKey('2026-10-25', 'Olha'),
      _test.buildBookingLockKey('2026-10-25', 'Max'),
    );
  });

  it('does not apply another master calendar entry to Olha', () => {
    const rows = [{
      date: '2026-10-25',
      payload: { duration: 180, master: 'Max' },
      status: 'reserved',
      time: '09:00',
    }];

    assert.deepEqual(_test.getCalendarIntervals(rows, '2026-10-25', 'Olha', employees), []);
  });

  it('does not assign a calendar entry without a master to the selected employee', () => {
    const rows = [{
      date: '2026-10-25',
      payload: { duration: 180 },
      status: 'reserved',
      time: '09:00',
    }];

    assert.deepEqual(_test.getCalendarIntervals(rows, '2026-10-25', 'Olha', employees), []);
  });

  it('does not assign a pending request without a master to the selected employee', () => {
    const rows = [{
      duration_minutes: 60,
      preferred_date: '2026-10-25',
      preferred_master: '',
      preferred_time: '09:00',
      status: 'pending',
    }];

    assert.deepEqual(_test.getPendingIntervals(rows, '2026-10-25', 'Olha', employees), []);
  });

  it('still applies an explicit Olha request only to Olha', () => {
    const rows = [{
      duration_minutes: 60,
      preferred_date: '2026-10-25',
      preferred_master: 'Olha',
      preferred_time: '09:00',
      status: 'pending',
    }];

    assert.equal(_test.getPendingIntervals(rows, '2026-10-25', 'Olha', employees).length, 1);
    assert.deepEqual(_test.getPendingIntervals(rows, '2026-10-25', 'Max', employees), []);
  });
});
