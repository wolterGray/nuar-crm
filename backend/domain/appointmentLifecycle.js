const APPOINTMENT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
});

const STATUS_ALIASES = new Map([
  ['scheduled', APPOINTMENT_STATUS.SCHEDULED],
  ['planned', APPOINTMENT_STATUS.SCHEDULED],
  ['confirmed', APPOINTMENT_STATUS.SCHEDULED],
  ['booked', APPOINTMENT_STATUS.SCHEDULED],
  ['reserved', APPOINTMENT_STATUS.SCHEDULED],
  ['completed', APPOINTMENT_STATUS.COMPLETED],
  ['done', APPOINTMENT_STATUS.COMPLETED],
  ['closed', APPOINTMENT_STATUS.COMPLETED],
  ['cancelled', APPOINTMENT_STATUS.CANCELLED],
  ['canceled', APPOINTMENT_STATUS.CANCELLED],
  ['no_show', APPOINTMENT_STATUS.NO_SHOW],
  ['no-show', APPOINTMENT_STATUS.NO_SHOW],
  ['noshow', APPOINTMENT_STATUS.NO_SHOW],
]);

const EDITABLE_TRANSITIONS = Object.freeze({
  [APPOINTMENT_STATUS.SCHEDULED]: new Set([
    APPOINTMENT_STATUS.SCHEDULED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
  ]),
  [APPOINTMENT_STATUS.CANCELLED]: new Set([
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.SCHEDULED,
  ]),
  [APPOINTMENT_STATUS.NO_SHOW]: new Set([
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.SCHEDULED,
  ]),
  [APPOINTMENT_STATUS.COMPLETED]: new Set([APPOINTMENT_STATUS.COMPLETED]),
});

const lifecycleError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const normalizeAppointmentStatus = (value, fallback = APPOINTMENT_STATUS.SCHEDULED) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;

  const status = STATUS_ALIASES.get(normalized);
  if (!status) {
    throw lifecycleError(`Unknown appointment status: ${value}`);
  }
  return status;
};

const assertEditableAppointmentTransition = (fromValue, toValue) => {
  const from = normalizeAppointmentStatus(fromValue);
  const to = normalizeAppointmentStatus(toValue, from);

  if (to === APPOINTMENT_STATUS.COMPLETED && from !== APPOINTMENT_STATUS.COMPLETED) {
    throw lifecycleError('Use the visit completion action to complete an appointment');
  }
  if (from === APPOINTMENT_STATUS.COMPLETED && to !== APPOINTMENT_STATUS.COMPLETED) {
    throw lifecycleError('Use the completed visit revert action to reopen an appointment');
  }
  if (!EDITABLE_TRANSITIONS[from]?.has(to)) {
    throw lifecycleError(`Appointment transition ${from} -> ${to} is not allowed`);
  }

  return to;
};

const assertCreatableAppointmentStatus = (value) => {
  const status = normalizeAppointmentStatus(value);
  if (status === APPOINTMENT_STATUS.COMPLETED) {
    throw lifecycleError('Use the visit completion action to create a completed appointment');
  }
  return status;
};

module.exports = {
  APPOINTMENT_STATUS,
  assertCreatableAppointmentStatus,
  assertEditableAppointmentTransition,
  normalizeAppointmentStatus,
};
