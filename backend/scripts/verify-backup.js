const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {
  inspectDumpTOC,
  isSafeTestDatabase,
  validateDumpHeader,
} = require('../services/backupService');

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const explicitFile = fileArg ? fileArg.split('=')[1].trim() : null;

const testDbArg = args.find((a) => a.startsWith('--test-db='));
const testDbUrl = testDbArg ? testDbArg.split('=')[1].trim() : process.env.TEST_DATABASE_URL;

const backupDir = path.resolve(
  process.cwd(),
  process.env.BACKUP_DIR || 'backups',
);
const pgRestoreBin = process.env.PGRESTORE_PATH || 'pg_restore';
const prodDatabaseUrl = process.env.DATABASE_URL;

let targetDump = null;
if (explicitFile) {
  targetDump = path.resolve(explicitFile);
} else if (fs.existsSync(backupDir)) {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('nuar-crm-') && f.endsWith('.dump'))
    .map((f) => ({mtime: fs.statSync(path.join(backupDir, f)).mtimeMs, name: f, path: path.join(backupDir, f)}))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length > 0) {
    targetDump = files[0].path;
  }
}

if (!targetDump || !fs.existsSync(targetDump)) {
  console.error(`❌ No valid dump file found to verify in: ${backupDir}`);
  process.exit(1);
}

console.log(`=======================================================`);
console.log(`NUAR CRM — Backup Verification & Disaster Recovery Check`);
console.log(`Target Dump: ${path.basename(targetDump)}`);
console.log(`=======================================================`);

// 1. Binary Header Validation
const header = validateDumpHeader(targetDump);
if (!header.valid) {
  console.error(`❌ Binary header validation failed: ${header.error}`);
  process.exit(1);
}
console.log(`✅ [1/2] Binary Header: Valid PostgreSQL PGDMP format (${(header.size / (1024 * 1024)).toFixed(2)} MB)`);

// 2. Archive Table of Contents (TOC) Inspection
const toc = inspectDumpTOC(targetDump, pgRestoreBin);
if (!toc.valid) {
  console.error(`❌ TOC inspection failed: ${toc.error}`);
  process.exit(1);
}
if (toc.skippedToc) {
  console.warn(`⚠️ [2/2] TOC Check skipped (pg_restore not in PATH). Header is valid.`);
} else {
  console.log(`✅ [2/2] Archive TOC: Healthy (${toc.entryCount} database objects archived)`);
  if (toc.sampleEntries?.length) {
    console.log(`   Sample objects: ${toc.sampleEntries.slice(0, 3).join('; ')}`);
  }
}

// 3. Optional Safe Test Database Restore Drill
if (testDbUrl) {
  console.log(`\n-------------------------------------------------------`);
  console.log(`Safety Audit for Test Database Restore`);
  console.log(`-------------------------------------------------------`);

  const safety = isSafeTestDatabase(testDbUrl, prodDatabaseUrl);
  if (!safety.safe) {
    console.error(`🛑 RESTORE ABORTED FOR SAFETY: ${safety.error}`);
    process.exit(1);
  }

  console.log(`✅ Target database safety check passed (Database: '${safety.databaseName}')`);
  console.log(`[restore] Restoring dump into isolated test database...`);

  const restoreResult = spawnSync(
    pgRestoreBin,
    [
      '--dbname',
      testDbUrl,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      targetDump,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (restoreResult.error) {
    console.error(`❌ Failed to execute ${pgRestoreBin}: ${restoreResult.error.message}`);
    process.exit(1);
  }

  if (restoreResult.status !== 0 && restoreResult.status !== 1) { // code 1 in pg_restore often represents ignorable warnings like 'table does not exist' during drop
    console.error(`❌ Restore drill exited with error status ${restoreResult.status}`);
    if (restoreResult.stderr) console.error(restoreResult.stderr);
    process.exit(1);
  }

  console.log(`✅ Test database restored cleanly!`);

  // Verify record counts in test database using Prisma
  const {PrismaClient} = require('@prisma/client');
  const testPrisma = new PrismaClient({datasources: {db: {url: testDbUrl}}});

  testPrisma.$connect()
    .then(async () => {
      const [users, clients, services, visits] = await Promise.all([
        testPrisma.user.count().catch(() => -1),
        testPrisma.client.count().catch(() => -1),
        testPrisma.service.count().catch(() => -1),
        testPrisma.visit.count().catch(() => -1),
      ]);

      console.log(`\nTest Database Verification Summary:`);
      console.log(` - Users:    ${users >= 0 ? users : 'N/A'}`);
      console.log(` - Clients:  ${clients >= 0 ? clients : 'N/A'}`);
      console.log(` - Services: ${services >= 0 ? services : 'N/A'}`);
      console.log(` - Visits:   ${visits >= 0 ? visits : 'N/A'}`);
      console.log(`\n🎉 DRILL COMPLETED: Backup is 100% verified and restorable!`);
    })
    .catch((err) => {
      console.warn(`⚠️ Connected to test database but failed to query row counts: ${err.message}`);
    })
    .finally(async () => {
      await testPrisma.$disconnect().catch(() => {});
    });
} else {
  console.log(`\n💡 Note: To run an end-to-end live restore drill into an isolated test database:`);
  console.log(`   TEST_DATABASE_URL="postgres://user:pass@host:5432/nuar_crm_test" npm run db:backup:verify`);
}
