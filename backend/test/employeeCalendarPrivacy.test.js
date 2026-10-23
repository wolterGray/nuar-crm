const assert = require('node:assert/strict');
const {test} = require('node:test');
const employeesRouter = require('../routes/employees');

test('coworker directory record exposes only calendar-safe fields', () => {
  const sanitized = employeesRouter._private.sanitizeCalendarEmployee({
    color: '#e11d2e',
    commissionRate: 40,
    email: 'private@example.com',
    id: 3,
    name: 'Olha',
    payload: {
      bookingBlockedDates: ['2026-10-25'],
      payrollSettings: {private: true},
      workingDaysOfWeek: [1, 2, 3],
    },
    phone: '+48123123123',
    shiftEnd: '20:00',
    shiftStart: '09:00',
    status: 'Активен',
  });

  assert.equal(sanitized.name, 'Olha');
  assert.deepEqual(sanitized.payload.bookingBlockedDates, ['2026-10-25']);
  assert.equal(JSON.stringify(sanitized).includes('private@example.com'), false);
  assert.equal(JSON.stringify(sanitized).includes('+48123123123'), false);
  assert.equal(JSON.stringify(sanitized).includes('commissionRate'), false);
  assert.equal(JSON.stringify(sanitized).includes('payrollSettings'), false);
});
