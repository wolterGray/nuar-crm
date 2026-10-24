const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  CATEGORY,
  getNotificationCategory,
  isAllowedNotificationType,
  isEventCurrent,
} = require('../services/notificationTypeRegistry');

test('classifies allowed business event types independently from numeric score', () => {
  assert.equal(getNotificationCategory({priority: 'high', score: 100, type: 'visit_rescheduled'}), CATEGORY.INFORMATION);
  assert.equal(getNotificationCategory({priority: 'normal', score: 1, type: 'booking_request'}), CATEGORY.ACTION);
  assert.equal(getNotificationCategory({type: 'supply_out_of_stock'}), CATEGORY.CRITICAL);
  assert.equal(getNotificationCategory({type: 'supply_low_stock'}), CATEGORY.ACTION);
  assert.equal(getNotificationCategory({type: 'waitlist_entry'}), CATEGORY.ACTION);
});

test('disallows obsolete junk notification types', () => {
  assert.equal(isAllowedNotificationType('client_inactive'), false);
  assert.equal(isAllowedNotificationType('package_ending'), false);
  assert.equal(isAllowedNotificationType('certificate_expiring'), false);
  assert.equal(isAllowedNotificationType('visit_upcoming'), false);
  assert.equal(isAllowedNotificationType('task_due'), false);

  assert.equal(isAllowedNotificationType('booking_request'), true);
  assert.equal(isAllowedNotificationType('site_booking_request'), true);
  assert.equal(isAllowedNotificationType('visit_created'), true);
  assert.equal(isAllowedNotificationType('visit_rescheduled'), true);
  assert.equal(isAllowedNotificationType('visit_cancelled'), true);
  assert.equal(isAllowedNotificationType('waitlist_entry'), true);
  assert.equal(isAllowedNotificationType('supply_low_stock'), true);
  assert.equal(isAllowedNotificationType('supply_out_of_stock'), true);
});

test('supply events follow the actual stock condition', () => {
  assert.equal(isEventCurrent({type: 'supply_low_stock'}, {supply: {stock: 8, minStock: 5}}), false);
  assert.equal(isEventCurrent({type: 'supply_low_stock'}, {supply: {stock: 3, minStock: 5}}), true);
  assert.equal(isEventCurrent({type: 'supply_out_of_stock'}, {supply: {stock: 0, minStock: 5}}), true);
  assert.equal(isEventCurrent({type: 'supply_out_of_stock'}, {supply: {stock: 2, minStock: 5}}), false);
});

test('waitlist events follow terminal status rules', () => {
  assert.equal(isEventCurrent({type: 'waitlist_entry'}, {waitlistEntry: {status: 'active'}}), true);
  assert.equal(isEventCurrent({type: 'waitlist_entry'}, {waitlistEntry: {status: 'closed'}}), false);
  assert.equal(isEventCurrent({type: 'waitlist_entry'}, {waitlistEntry: {status: 'booked'}}), false);
});
