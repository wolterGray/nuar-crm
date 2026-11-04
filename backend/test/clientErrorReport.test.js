const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeClientErrorReport} = require('../domain/clientErrorReport');

test('client error report is bounded, attributed, and redacts credentials', () => {
  const report = normalizeClientErrorReport({
    componentStack: `Calendar Bearer component-secret ${'c'.repeat(5000)}`,
    message: `Request failed Bearer message-secret ${'m'.repeat(600)}`,
    path: `/${'p'.repeat(400)}`,
    release: '2026.11.04',
    stack: `Error: Bearer stack-secret ${'s'.repeat(5000)}`,
  }, {sub: 42});

  assert.equal(report.source, 'frontend');
  assert.equal(report.context.actorId, '42');
  assert.equal(report.context.release, '2026.11.04');
  assert.equal(report.context.path.length, 300);
  assert.ok(report.message.length <= 500);
  assert.ok(report.error.stack.length <= 4000);
  assert.ok(report.context.componentStack.length <= 4000);
  assert.doesNotMatch(JSON.stringify(report), /message-secret|stack-secret|component-secret/);
});

test('client error report rejects an empty message and tolerates missing optional fields', () => {
  assert.equal(normalizeClientErrorReport({message: '   '}), null);

  const report = normalizeClientErrorReport({message: 'Render failed'});
  assert.equal(report.message, 'Render failed');
  assert.equal(report.error, null);
  assert.equal(report.context.actorId, 'unknown');
  assert.equal(report.context.path, '');
});
