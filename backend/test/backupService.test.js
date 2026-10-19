const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  PGDUMP_MAGIC,
  applyRetentionPolicy,
  getBackupStatus,
  isSafeTestDatabase,
  sanitizePostgresUrlForCli,
  validateDumpHeader,
} = require('../services/backupService');

test('validateDumpHeader: validates PostgreSQL custom dump magic header', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  const validFile = path.join(tmpDir, 'valid.dump');
  const invalidFile = path.join(tmpDir, 'invalid.dump');
  const emptyFile = path.join(tmpDir, 'empty.dump');

  // Valid dump begins with PGDMP
  fs.writeFileSync(validFile, Buffer.concat([PGDUMP_MAGIC, Buffer.from([1, 14, 0, 0, 0, 42])]));
  // Invalid dump
  fs.writeFileSync(invalidFile, Buffer.from('NOT_A_PG_DUMP_CORRUPTED'));
  // Empty dump
  fs.writeFileSync(emptyFile, Buffer.alloc(0));

  const validRes = validateDumpHeader(validFile);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.size, 11);

  const invalidRes = validateDumpHeader(invalidFile);
  assert.equal(invalidRes.valid, false);
  assert.match(invalidRes.error, /Invalid dump header/);

  const emptyRes = validateDumpHeader(emptyFile);
  assert.equal(emptyRes.valid, false);

  const missingRes = validateDumpHeader(path.join(tmpDir, 'non-existent.dump'));
  assert.equal(missingRes.valid, false);
  assert.equal(missingRes.error, 'File does not exist');

  fs.rmSync(tmpDir, {force: true, recursive: true});
});

test('applyRetentionPolicy: keeps newest N backups and prunes older ones safely', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-retention-'));

  const files = [
    'nuar-crm-scheduled-2026-10-10.dump',
    'nuar-crm-scheduled-2026-10-11.dump',
    'nuar-crm-scheduled-2026-10-12.dump',
    'nuar-crm-scheduled-2026-10-13.dump',
    'nuar-crm-scheduled-2026-10-14.dump',
  ];

  files.forEach((f, idx) => {
    const fullPath = path.join(tmpDir, f);
    fs.writeFileSync(fullPath, 'dummy content');
    // Set explicit mtime in the past
    const time = new Date(2026, 9, 10 + idx, 12, 0, 0);
    fs.utimesSync(fullPath, time, time);
  });

  const res = applyRetentionPolicy(tmpDir, {maxKeep: 3});
  assert.equal(res.kept.length, 3);
  assert.equal(res.deleted.length, 2);
  assert.deepEqual(res.deleted, [
    'nuar-crm-scheduled-2026-10-11.dump',
    'nuar-crm-scheduled-2026-10-10.dump',
  ]);

  const remaining = fs.readdirSync(tmpDir);
  assert.equal(remaining.length, 3);
  assert.ok(remaining.includes('nuar-crm-scheduled-2026-10-14.dump'));
  assert.ok(remaining.includes('nuar-crm-scheduled-2026-10-13.dump'));
  assert.ok(remaining.includes('nuar-crm-scheduled-2026-10-12.dump'));

  fs.rmSync(tmpDir, {force: true, recursive: true});
});

test('isSafeTestDatabase: prevents accidental destruction of production database', () => {
  const prodUrl = 'postgres://nuar_user:secret@159.69.1.1:5432/nuar_production?schema=public';

  // 1. Identical URL must be blocked
  const res1 = isSafeTestDatabase(prodUrl, prodUrl);
  assert.equal(res1.safe, false);
  assert.match(res1.error, /identical to DATABASE_URL/);

  // 2. Production database name must be blocked even on localhost or another host
  const res2 = isSafeTestDatabase('postgres://nuar_user:secret@127.0.0.1:5432/nuar_production', prodUrl);
  assert.equal(res2.safe, false);
  assert.match(res2.error, /matches production database name/);

  // 3. Database without test/staging/dev keywords must be blocked
  const res3 = isSafeTestDatabase('postgres://nuar_user:secret@localhost:5432/client_crm', prodUrl);
  assert.equal(res3.safe, false);
  assert.match(res3.error, /does not contain 'test', 'staging', or 'dev'/);

  // 4. Dedicated test database must be accepted
  const res4 = isSafeTestDatabase('postgres://nuar_user:secret@localhost:5432/nuar_crm_test', prodUrl);
  assert.equal(res4.safe, true);
  assert.equal(res4.databaseName, 'nuar_crm_test');

  // 5. Staging database must be accepted
  const res5 = isSafeTestDatabase('postgres://nuar_user:secret@localhost:5432/nuar_staging', prodUrl);
  assert.equal(res5.safe, true);
  assert.equal(res5.databaseName, 'nuar_staging');
});

test('getBackupStatus: correctly summarizes backup directory status', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-status-'));

  const emptyStatus = getBackupStatus(tmpDir);
  assert.equal(emptyStatus.available, false);
  assert.equal(emptyStatus.count, 0);

  const dumpPath = path.join(tmpDir, 'nuar-crm-daily-2026-10-19.dump');
  fs.writeFileSync(dumpPath, Buffer.concat([PGDUMP_MAGIC, Buffer.alloc(100)]));

  const status = getBackupStatus(tmpDir);
  assert.equal(status.available, true);
  assert.equal(status.count, 1);
  assert.equal(status.latest.name, 'nuar-crm-daily-2026-10-19.dump');
  assert.equal(status.latest.isValid, true);

  fs.rmSync(tmpDir, {force: true, recursive: true});
});

test('sanitizePostgresUrlForCli: removes Prisma schema and non-libpq query params', () => {
  // 1. Removes schema=public
  const prismaUrl = 'postgresql://nuar:secret@localhost:5432/nuar_crm?schema=public';
  assert.equal(
    sanitizePostgresUrlForCli(prismaUrl),
    'postgresql://nuar:secret@localhost:5432/nuar_crm',
  );

  // 2. Removes multiple Prisma-specific params while keeping valid libpq params like sslmode
  const complexUrl = 'postgresql://nuar:secret@10.0.0.1:5432/nuar_crm?schema=public&sslmode=require&connection_limit=5&pool_timeout=10';
  assert.equal(
    sanitizePostgresUrlForCli(complexUrl),
    'postgresql://nuar:secret@10.0.0.1:5432/nuar_crm?sslmode=require',
  );

  // 3. Handles empty or non-URL strings safely
  assert.equal(sanitizePostgresUrlForCli(''), '');
  assert.equal(sanitizePostgresUrlForCli(null), '');
  assert.equal(sanitizePostgresUrlForCli('not-a-valid-url'), 'not-a-valid-url');
});
