const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '../scripts/deploy-production.sh');

test('production deploy waits for full backend readiness', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.match(script, /READINESS_URL=.*\/ready/);
  assert.match(script, /curl[^\n]+\$\{READINESS_URL\}/);
  assert.doesNotMatch(script, /HEALTH_URL|curl[^\n]+\/health/);
});
