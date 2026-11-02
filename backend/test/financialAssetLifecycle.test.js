const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCertificateStatus,
  normalizeClientPackageStatus,
  resolveCertificateStatus,
  resolveClientPackageStatus,
} = require('../domain/financialAssetLifecycle');

test('financial asset statuses normalize known aliases and reject arbitrary values', () => {
  assert.equal(normalizeClientPackageStatus('paused'), 'Пауза');
  assert.equal(normalizeCertificateStatus('redeemed'), 'Погашен');
  assert.throws(() => normalizeClientPackageStatus('unknown'), /Unknown financial asset status/);
  assert.throws(() => normalizeCertificateStatus('unknown'), /Unknown financial asset status/);
});

test('package status follows its remaining visit balance', () => {
  assert.equal(resolveClientPackageStatus(0, 'Активен'), 'Архив');
  assert.equal(resolveClientPackageStatus(2, 'Архив'), 'Активен');
  assert.equal(resolveClientPackageStatus(2, 'Пауза'), 'Пауза');
});

test('certificate status follows its remaining money balance', () => {
  assert.equal(resolveCertificateStatus(0, 500, 'Активен'), 'Погашен');
  assert.equal(resolveCertificateStatus(250, 500, 'Активен'), 'Частично');
  assert.equal(resolveCertificateStatus(500, 500, 'Просрочен'), 'Активен');
});
