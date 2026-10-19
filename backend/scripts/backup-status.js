const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {getBackupStatus} = require('../services/backupService');

const backupDir = path.resolve(
  process.cwd(),
  process.env.BACKUP_DIR || 'backups',
);

console.log(`Checking backup status in: ${backupDir}`);
const status = getBackupStatus(backupDir);

if (!status.available) {
  console.log(`⚠️ Status: No backups found (${status.error || status.message})`);
  process.exit(0);
}

console.log(`✅ Status: ${status.count} backup file(s) available.`);
console.log(`   Latest Dump:  ${status.latest.name}`);
console.log(`   Size:         ${status.latest.sizeFormatted}`);
console.log(`   Created At:   ${status.latest.createdAt}`);
console.log(`   Valid Format: ${status.latest.isValid ? 'YES (Valid PGDMP)' : 'NO (' + status.latest.validationError + ')'}`);
