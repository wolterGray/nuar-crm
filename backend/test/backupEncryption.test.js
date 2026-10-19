const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { encryptDumpFile, decryptDumpFile } = require('../services/backupService');

test('Backup Encryption: AES-256-GCM roundtrip encryption and decryption', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-enc-test-'));
  const plainFile = path.join(tmpDir, 'test.dump');
  const encFile = path.join(tmpDir, 'test.dump.enc');
  const decFile = path.join(tmpDir, 'test.decrypted.dump');

  const secretKey = 'super-secret-backup-encryption-key-2026';
  const originalData = Buffer.from('PGDMP-test-data-with-sensitive-database-records-' + Date.now());

  fs.writeFileSync(plainFile, originalData);

  // 1. Encrypt
  const encResult = encryptDumpFile(plainFile, encFile, secretKey);
  assert.equal(encResult.algorithm, 'aes-256-gcm');
  assert.ok(fs.existsSync(encFile));
  assert.ok(encResult.encryptedBytes > originalData.length); // includes IV and AuthTag

  // Verify the encrypted file does not contain plain text
  const encBytes = fs.readFileSync(encFile);
  assert.equal(encBytes.includes('PGDMP-test-data'), false, 'Encrypted file must not contain plaintext strings');

  // 2. Decrypt
  const decResult = decryptDumpFile(encFile, decFile, secretKey);
  assert.equal(decResult.valid, true);
  assert.ok(fs.existsSync(decFile));

  const decryptedBytes = fs.readFileSync(decFile);
  assert.deepEqual(decryptedBytes, originalData, 'Decrypted bytes must match original dump bytes');

  // 3. Tamper test: Corrupting 1 byte in ciphertext must throw authentication error in GCM
  const tamperedBytes = Buffer.from(encBytes);
  tamperedBytes[tamperedBytes.length - 1] ^= 0xff; // Flip bits in last byte
  const tamperedFile = path.join(tmpDir, 'tampered.enc');
  fs.writeFileSync(tamperedFile, tamperedBytes);

  assert.throws(
    () => decryptDumpFile(tamperedFile, path.join(tmpDir, 'should-fail.dump'), secretKey),
    /unsupported state or unable to authenticate data|bad decrypt/i,
    'Tampered encrypted file must fail authentication in AES-256-GCM',
  );

  // 4. Wrong key test
  assert.throws(
    () => decryptDumpFile(encFile, path.join(tmpDir, 'wrong-key.dump'), 'wrong-password-key-1234'),
    /unsupported state or unable to authenticate data|bad decrypt/i,
    'Decryption with wrong key must fail',
  );

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
