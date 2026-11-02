const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findCalendarConflicts,
  getCalendarLockKeys,
  getEntryMasters,
} = require('../domain/calendarScheduling');

test('detects overlap for either master of a parallel visit', () => {
  const candidate = {
    date: '2026-11-03', duration: 60, master: 'Max', secondaryMaster: 'Olha', time: '10:00',
  };
  const entries = [
    {id: 1, date: '2026-11-03', duration: 60, master: 'Olha', status: 'scheduled', time: '10:30'},
    {id: 2, date: '2026-11-03', duration: 60, master: 'Artem', status: 'scheduled', time: '10:30'},
  ];
  assert.deepEqual(findCalendarConflicts(candidate, entries).map((entry) => entry.id), [1]);
});

test('ignores cancelled, adjacent, and edited entries', () => {
  const candidate = {id: 3, date: '2026-11-03', duration: 60, master: 'Max', time: '10:00'};
  const entries = [
    {...candidate, status: 'scheduled'},
    {id: 4, date: candidate.date, duration: 60, master: 'Max', status: 'scheduled', time: '11:00'},
    {id: 5, date: candidate.date, duration: 60, master: 'Max', status: 'cancelled', time: '10:30'},
  ];
  assert.deepEqual(findCalendarConflicts(candidate, entries, candidate.id), []);
});

test('normalizes and sorts lock keys for parallel masters', () => {
  const entry = {date: '2026-11-03', master: ' Olha ', secondaryMaster: 'MAX'};
  assert.deepEqual(getEntryMasters(entry), ['olha', 'max']);
  assert.deepEqual(getCalendarLockKeys(entry), [
    'calendar:2026-11-03:max',
    'calendar:2026-11-03:olha',
  ]);
});
