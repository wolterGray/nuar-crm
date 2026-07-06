const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve(
  process.cwd(),
  process.env.BACKUP_DIR || 'backups',
);
const pgDumpBin = process.env.PGDUMP_PATH || 'pg_dump';
const databaseUrl = process.env.DATABASE_URL;
const outputFile = path.join(backupDir, `nuar-crm-${timestamp}.dump`);

if (!databaseUrl) {
  console.error('DATABASE_URL is required to create a database backup.');
  process.exit(1);
}

fs.mkdirSync(backupDir, {recursive: true});

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
  console.error(`Failed to start ${pgDumpBin}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || `pg_dump exited with code ${result.status}`);
  process.exit(result.status || 1);
}

if (result.stderr) {
  console.warn(result.stderr.trim());
}

console.log(`Backup created: ${outputFile}`);
