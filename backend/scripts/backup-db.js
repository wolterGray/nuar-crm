const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {
  applyRetentionPolicy,
  inspectDumpTOC,
  validateDumpHeader,
} = require('../services/backupService');

// Parse CLI flags (e.g. --tag=daily or --tag=weekly)
const args = process.argv.slice(2);
const tagArg = args.find((a) => a.startsWith('--tag='));
const tag = tagArg ? tagArg.split('=')[1].trim() : 'scheduled';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve(
  process.cwd(),
  process.env.BACKUP_DIR || 'backups',
);
const pgDumpBin = process.env.PGDUMP_PATH || 'pg_dump';
const pgRestoreBin = process.env.PGRESTORE_PATH || 'pg_restore';
const databaseUrl = process.env.DATABASE_URL;
const outputFile = path.join(backupDir, `nuar-crm-${tag}-${timestamp}.dump`);
const maxRetention = Number(process.env.BACKUP_RETENTION_COUNT) || 14;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is required to create a database backup.');
  process.exit(1);
}

fs.mkdirSync(backupDir, {recursive: true});

console.log(`[backup] Creating PostgreSQL dump [tag: ${tag}]...`);
const result = spawnSync(
  pgDumpBin,
  [
    databaseUrl,
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file',
    outputFile,
  ],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (result.error) {
  console.error(`❌ Failed to start ${pgDumpBin}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || `❌ pg_dump exited with code ${result.status}`);
  process.exit(result.status || 1);
}

if (result.stderr) {
  console.warn(result.stderr.trim());
}

// 1. Validate Dump Header & Size
const headerCheck = validateDumpHeader(outputFile);
if (!headerCheck.valid) {
  console.error(`❌ Dump validation failed: ${headerCheck.error}`);
  try { fs.unlinkSync(outputFile); } catch {}
  process.exit(1);
}

// 2. Validate TOC via pg_restore
const tocCheck = inspectDumpTOC(outputFile, pgRestoreBin);
if (!tocCheck.valid) {
  console.error(`❌ Dump TOC validation failed: ${tocCheck.error}`);
  try { fs.unlinkSync(outputFile); } catch {}
  process.exit(1);
}

console.log(`✅ Backup created and verified successfully:`);
console.log(`   Path: ${outputFile}`);
console.log(`   Size: ${(headerCheck.size / (1024 * 1024)).toFixed(2)} MB (${headerCheck.size} bytes)`);
if (tocCheck.entryCount) {
  console.log(`   TOC Entries: ${tocCheck.entryCount} database objects`);
}

// 3. Apply retention policy
const retention = applyRetentionPolicy(backupDir, {maxKeep: maxRetention});
if (retention.deleted.length > 0) {
  console.log(`[retention] Pruned ${retention.deleted.length} old backups: ${retention.deleted.join(', ')}`);
}
console.log(`[retention] Retaining ${retention.kept.length} recent backup(s) (limit: ${maxRetention})`);

// 4. Save metadata summary
const metaFile = path.join(backupDir, 'latest-backup.json');
try {
  fs.writeFileSync(metaFile, JSON.stringify({
    createdAt: new Date().toISOString(),
    entryCount: tocCheck.entryCount || null,
    file: path.basename(outputFile),
    isValid: true,
    sizeBytes: headerCheck.size,
    tag,
  }, null, 2));
} catch {}
