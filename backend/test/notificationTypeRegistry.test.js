const assert = require('node:assert/strict');
const {test} = require('node:test');
const {
  CATEGORY,
  getNotificationCategory,
  isEventCurrent,
} = require('../services/notificationTypeRegistry');

test('classifies business event types independently from numeric score', () => {
  assert.equal(getNotificationCategory({score: 100, type: 'client_inactive'}), CATEGORY.OPPORTUNITY);
  assert.equal(getNotificationCategory({priority: 'high', score: 100, type: 'visit_rescheduled'}), CATEGORY.INFORMATION);
  assert.equal(getNotificationCategory({priority: 'normal', score: 1, type: 'task_due'}), CATEGORY.ACTION);
  assert.equal(getNotificationCategory({type: 'delivery_failed'}), CATEGORY.CRITICAL);
});

test('task event stops being current after completion or due-date move', () => {
  const now = new Date('2026-10-18T12:00:00');
  const event = {type: 'task_due'};
  assert.equal(isEventCurrent(event, {task: {completed: false, dueDate: new Date('2026-10-17T10:00:00')}} , now), true);
  assert.equal(isEventCurrent(event, {task: {completed: true, dueDate: new Date('2026-10-17T10:00:00')}} , now), false);
  assert.equal(isEventCurrent(event, {task: {completed: false, dueDate: new Date('2026-10-19T10:00:00')}} , now), false);
});

test('supply and package events follow the current business condition', () => {
  assert.equal(isEventCurrent({type: 'supply_low_stock'}, {supply: {stock: 8, minStock: 5}}), false);
  assert.equal(isEventCurrent({type: 'supply_low_stock'}, {supply: {stock: 3, minStock: 5}}), true);
  assert.equal(isEventCurrent({type: 'package_ending'}, {clientPackage: {remainingVisits: 0, status: 'active'}}), true);
  assert.equal(isEventCurrent({type: 'package_ending'}, {clientPackage: {remainingVisits: 0, status: 'closed'}}), false);
});
