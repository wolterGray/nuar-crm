#!/usr/bin/env node
/**
 * CLI utility to encrypt or decrypt database backup files using AES-256-GCM.
 *
 * Usage:
 *   # Encrypt:
 *   node backend/scripts/encrypt-backup.js /var/backups/nuar-crm/crm_backup_xxx.dump
 *   # Output: /var/backups/nuar-crm/crm_backup_xxx.dump.enc
 *
 *   # Decrypt:
 *   node backend/scripts/encrypt-backup.js --decrypt /var/backups/nuar-crm/crm_backup_xxx.dump.enc /tmp/restored.dump
 */

const path = require('path');
const { encryptDumpFile, decryptDumpFile } = require('../services/backupService');

const args = process.argv.slice(2);
const isDecrypt = args[0] === '--decrypt';

if (isDecrypt) {
  const source = args[1];
  const dest = args[2];
  if (!source || !dest) {
    console.error('Usage: node encrypt-backup.js --decrypt <encrypted_file> <output_file>');
    process.exit(1);
  }

  const key = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    console.error('Error: BACKUP_ENCRYPTION_KEY or JWT_SECRET must be set');
    process.exit(1);
  }

  try {
    const res = decryptDumpFile(path.resolve(source), path.resolve(dest), key);
    console.log(`✅ File decrypted successfully: ${res.destPath} (${res.decryptedBytes} bytes)`);
  } catch (err) {
    console.error(`❌ Decryption failed: ${err.message}`);
    process.exit(1);
  }
} else {
  const source = args[0];
  if (!source) {
    console.error('Usage: node encrypt-backup.js <dump_file> [output_file]');
    process.exit(1);
  }

  const dest = args[1] || `${source}.enc`;
  const key = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    console.error('Error: BACKUP_ENCRYPTION_KEY or JWT_SECRET must be set');
    process.exit(1);
  }

  try {
    const res = encryptDumpFile(path.resolve(source), path.resolve(dest), key);
    console.log(`✅ File encrypted successfully (AES-256-GCM): ${res.destPath} (${res.encryptedBytes} bytes)`);
  } catch (err) {
    console.error(`❌ Encryption failed: ${err.message}`);
    process.exit(1);
  }
}
