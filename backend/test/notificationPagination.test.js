const assert = require('node:assert/strict');
const {test} = require('node:test');
const {paginateNotificationEvents} = require('../services/notificationEventsService');

test('notification pagination keeps a stable newest-first window', () => {
  const events = Array.from({length: 125}, (_, index) => ({id: index + 1}));
  const first = paginateNotificationEvents(events, {limit: 40, offset: 0});
  const second = paginateNotificationEvents(events, {limit: 40, offset: 40});
  const last = paginateNotificationEvents(events, {limit: 40, offset: 120});

  assert.equal(first.length, 40);
  assert.equal(second.length, 40);
  assert.equal(last.length, 5);
  assert.equal(first[0].id, 1);
  assert.equal(second[0].id, 41);
  assert.equal(last[4].id, 125);
  assert.equal(new Set([...first, ...second, ...last].map((event) => event.id)).size, 85);
});
