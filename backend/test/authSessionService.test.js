const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getSessionMetadata,
  hashRefreshToken,
  tokensMatch,
} = require('../services/authSessionService');

test('auth session hashes and compares refresh tokens without storing plaintext', () => {
  const token = 'refresh-token-value';
  const hash = hashRefreshToken(token);

  assert.notEqual(hash, token);
  assert.equal(tokensMatch(token, hash), true);
  assert.equal(tokensMatch('another-token', hash), false);
});

test('auth session extracts useful device metadata from request', () => {
  const metadata = getSessionMetadata({
    headers: {'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
    ip: '127.0.0.1',
  });

  assert.equal(metadata.ip, '127.0.0.1');
  assert.equal(metadata.deviceName, 'iPhone');
  assert.match(metadata.userAgent, /iPhone/);
});
