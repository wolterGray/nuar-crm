const test = require('node:test');
const assert = require('node:assert/strict');
const {
  APPOINTMENT_STATUS,
  assertCreatableAppointmentStatus,
  assertEditableAppointmentTransition,
  normalizeAppointmentStatus,
} = require('../domain/appointmentLifecycle');

test('normalizes legacy appointment status aliases', () => {
  assert.equal(normalizeAppointmentStatus('confirmed'), APPOINTMENT_STATUS.SCHEDULED);
  assert.equal(normalizeAppointmentStatus('canceled'), APPOINTMENT_STATUS.CANCELLED);
  assert.equal(normalizeAppointmentStatus('no-show'), APPOINTMENT_STATUS.NO_SHOW);
});

test('allows scheduling lifecycle transitions handled by calendar editing', () => {
  assert.equal(assertEditableAppointmentTransition('scheduled', 'cancelled'), 'cancelled');
  assert.equal(assertEditableAppointmentTransition('cancelled', 'scheduled'), 'scheduled');
  assert.equal(assertEditableAppointmentTransition('no_show', 'scheduled'), 'scheduled');
});

test('requires dedicated actions for completing and reopening completed visits', () => {
  assert.throws(
    () => assertEditableAppointmentTransition('scheduled', 'completed'),
    /completion action/,
  );
  assert.throws(
    () => assertEditableAppointmentTransition('completed', 'scheduled'),
    /revert action/,
  );
  assert.throws(() => assertCreatableAppointmentStatus('completed'), /completion action/);
});

test('rejects unknown statuses instead of persisting arbitrary values', () => {
  assert.throws(() => normalizeAppointmentStatus('waiting-room'), /Unknown appointment status/);
});
