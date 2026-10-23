const assert = require('node:assert/strict');
const {test} = require('node:test');
const visitsRouter = require('../routes/visits');

test('coworker calendar entry exposes schedule without client or financial data', () => {
  const sanitized = visitsRouter._private.sanitizeCoworkerCalendarEntry({
    date: '2026-10-23',
    id: 101,
    kind: 'visit',
    payload: {
      amount: 300,
      client: 'Private Client',
      clientId: 42,
      clientPhone: '+48123123123',
      duration: 75,
      master: 'Olha',
      note: 'Private note',
      payment: 'Card',
      service: 'Massage',
    },
    status: 'confirmed',
    time: '12:15',
  });

  assert.deepEqual(sanitized, {
    client: 'Занято',
    color: null,
    date: '2026-10-23',
    duration: 75,
    id: 101,
    kind: 'visit',
    master: 'Olha',
    payload: {color: null, duration: 75, master: 'Olha', service: 'Massage'},
    restricted: true,
    service: 'Massage',
    status: 'confirmed',
    time: '12:15',
  });
  assert.equal(JSON.stringify(sanitized).includes('Private Client'), false);
  assert.equal(JSON.stringify(sanitized).includes('300'), false);
  assert.equal(JSON.stringify(sanitized).includes('+48123123123'), false);
});
