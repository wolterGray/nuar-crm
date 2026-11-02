const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLinkedVisitCalendarUpdate,
  toScheduledAt,
} = require('../utils/visitCalendarConsistency');

test('calendar reschedule updates the linked visit snapshot without losing financial fields', () => {
  const visit = {
    id: 44,
    calendarEntryId: 12,
    clientId: 2,
    employeeId: 3,
    serviceId: 4,
    notes: 'old note',
    payload: {
      amount: 990,
      payment: 'Карта',
      packageUsageId: 18,
      date: '2026-11-02',
      time: '09:00',
    },
  };
  const calendarEntry = {
    id: 12,
    date: '2026-11-05',
    time: '11:15',
    status: 'completed',
    payload: {clientId: 8, employeeId: 9, serviceId: 10, note: 'new note'},
  };

  const update = buildLinkedVisitCalendarUpdate(visit, calendarEntry);

  assert.equal(update.calendarEntryId, 12);
  assert.equal(update.clientId, 8);
  assert.equal(update.employeeId, 9);
  assert.equal(update.serviceId, 10);
  assert.equal(update.notes, 'new note');
  assert.equal(update.payload.amount, 990);
  assert.equal(update.payload.payment, 'Карта');
  assert.equal(update.payload.packageUsageId, 18);
  assert.equal(update.payload.date, '2026-11-05');
  assert.equal(update.payload.inputDate, '2026-11-05');
  assert.equal(update.payload.time, '11:15');
  assert.equal(update.scheduledAt.getTime(), toScheduledAt('2026-11-05', '11:15').getTime());
});

test('calendar sync preserves linked ids when legacy payload omits them', () => {
  const update = buildLinkedVisitCalendarUpdate(
    {calendarEntryId: 7, clientId: 2, employeeId: 3, serviceId: 4, payload: {amount: 200}},
    {id: 7, date: '2026-11-06', time: '10:00', payload: {}},
  );

  assert.equal(update.clientId, 2);
  assert.equal(update.employeeId, 3);
  assert.equal(update.serviceId, 4);
  assert.equal(update.payload.amount, 200);
});

test('invalid calendar date does not create an invalid Date value', () => {
  assert.equal(toScheduledAt('', '10:00'), null);
  assert.equal(toScheduledAt('not-a-date', '10:00'), null);
});
