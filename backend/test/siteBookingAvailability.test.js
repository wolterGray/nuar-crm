const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { _test } = require('../routes/siteBooking');

const employees = [
  { name: 'Olha' },
  { name: 'Max' },
];

describe('site booking availability master isolation', () => {
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
