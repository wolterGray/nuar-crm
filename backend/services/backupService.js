const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');

const PGDUMP_MAGIC = Buffer.from('PGDMP');

const cleanString = (value) => String(value ?? '').trim();

/**
 * Validates the binary header of a PostgreSQL custom-format dump.
 */
const validateDumpHeader = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {valid: false, error: 'File does not exist', size: 0};
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 5) {
    return {valid: false, error: 'File is too small to be a valid PostgreSQL dump', size: stat.size};
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(5);
  try {
    fs.readSync(fd, buffer, 0, 5, 0);
  } finally {
    fs.closeSync(fd);
  }

  const matchesMagic = buffer.equals(PGDUMP_MAGIC);
  if (!matchesMagic) {
    return {
      error: `Invalid dump header: expected 'PGDMP', received '${buffer.toString('ascii')}'`,
      size: stat.size,
      valid: false,
    };
  }

  return {size: stat.size, valid: true};
};

/**
 * Validates the Table of Contents (TOC) of a dump using pg_restore --list.
 */
const inspectDumpTOC = (filePath, pgRestoreBin = process.env.PGRESTORE_PATH || 'pg_restore') => {
  const headerCheck = validateDumpHeader(filePath);
  if (!headerCheck.valid) {
    return {entryCount: 0, error: headerCheck.error, valid: false};
  }

  try {
    const result = spawnSync(pgRestoreBin, ['--list', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
      // pg_restore might not be in PATH in some environments (e.g. CI without postgres-client)
      return {
        entryCount: null,
        headerValid: true,
        skippedToc: true,
        valid: true,
        warning: `pg_restore not executable: ${result.error.message}`,
      };
    }

    if (result.status !== 0) {
      return {
        entryCount: 0,
        error: result.stderr || `pg_restore --list failed with code ${result.status}`,
        valid: false,
      };
    }

    const lines = (result.stdout || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith(';'));

    return {
      entryCount: lines.length,
      sampleEntries: lines.slice(0, 5),
      valid: lines.length > 0,
    };
  } catch (err) {
    return {
      entryCount: null,
      headerValid: true,
      skippedToc: true,
      valid: true,
      warning: err.message,
    };
  }
};

/**
 * Applies retention policy, deleting oldest dump files beyond maxKeep.
 */
const applyRetentionPolicy = (backupDir, {maxKeep = 14} = {}) => {
  if (!fs.existsSync(backupDir)) return {deleted: [], kept: []};

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('nuar-crm-') && (f.endsWith('.dump') || f.endsWith('.sql')))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return {mtime: stat.mtimeMs, name: f, path: fullPath, size: stat.size};
    })
    .sort((a, b) => b.mtime - a.mtime);

  const kept = files.slice(0, maxKeep);
  const toDelete = files.slice(maxKeep);

  const deleted = [];
  for (const file of toDelete) {
    try {
      fs.unlinkSync(file.path);
      deleted.push(file.name);
    } catch (err) {
      console.error(`[backupRetention] Failed to delete old dump ${file.name}:`, err.message);
    }
  }

  return {
    deleted,
    kept: kept.map((k) => k.name),
  };
};

/**
 * Returns latest backup health status.
 */
const getBackupStatus = (backupDir) => {
  if (!fs.existsSync(backupDir)) {
    return {available: false, count: 0, error: 'Backup directory does not exist'};
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('nuar-crm-') && (f.endsWith('.dump') || f.endsWith('.sql')))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return {mtime: stat.mtime, name: f, path: fullPath, size: stat.size};
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) {
    return {available: false, count: 0, message: 'No backups found'};
  }

  const latest = files[0];
  const headerCheck = latest.name.endsWith('.dump') ? validateDumpHeader(latest.path) : {valid: true, size: latest.size};

  return {
    available: true,
    count: files.length,
    latest: {
      createdAt: latest.mtime.toISOString(),
      isValid: headerCheck.valid,
      name: latest.name,
      sizeBytes: latest.size,
      sizeFormatted: `${(latest.size / (1024 * 1024)).toFixed(2)} MB`,
      validationError: headerCheck.error || null,
    },
  };
};

/**
 * Strict safety guard: verifies that a database URL is safe for test restores
 * and NOT the production database!
 */
const isSafeTestDatabase = (testUrl, prodUrl) => {
  const cleanTest = cleanString(testUrl);
  const cleanProd = cleanString(prodUrl);

  if (!cleanTest) {
    return {error: 'TEST_DATABASE_URL is empty', safe: false};
  }

  if (cleanTest === cleanProd) {
    return {error: 'DANGER: TEST_DATABASE_URL is identical to DATABASE_URL (production)! Aborting.', safe: false};
  }

  let testDbName;
  let prodDbName = '';

  try {
    const testParsed = new URL(cleanTest);
    testDbName = testParsed.pathname.replace(/^\//, '').toLowerCase();
  } catch {
    return {error: 'Invalid TEST_DATABASE_URL format', safe: false};
  }

  try {
    if (cleanProd) {
      const prodParsed = new URL(cleanProd);
      prodDbName = prodParsed.pathname.replace(/^\//, '').toLowerCase();
    }
  } catch {
    // If prod cannot be parsed, continue with name inspection
  }

  if (prodDbName && testDbName === prodDbName) {
    return {
      error: `DANGER: Target database name '${testDbName}' matches production database name! Aborting.`,
      safe: false,
    };
  }

  // Target database MUST contain safe keywords like test, staging, or dev
  const isSafeName = /test|staging|temp|dev|restore_drill|smoke/.test(testDbName);
  if (!isSafeName) {
    return {
      error: `DANGER: Target database name '${testDbName}' does not contain 'test', 'staging', or 'dev'. For safety, only dedicated test databases are permitted for automated restore verification.`,
      safe: false,
    };
  }

  return {databaseName: testDbName, safe: true};
};

/**
 * Encrypt a backup dump file using AES-256-GCM.
 * Output file format: [16 bytes IV][16 bytes AuthTag][Ciphertext]
 */
const encryptDumpFile = (sourcePath, destPath, secretKey) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source dump file does not exist: ${sourcePath}`);
  }
  if (!secretKey || String(secretKey).trim().length < 8) {
    throw new Error('Encryption secretKey must be at least 8 characters');
  }

  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const input = fs.readFileSync(sourcePath);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const finalPayload = Buffer.concat([iv, authTag, encrypted]);
  fs.writeFileSync(destPath, finalPayload);

  return {
    sourcePath,
    destPath,
    encryptedBytes: finalPayload.length,
    algorithm: 'aes-256-gcm',
  };
};

/**
 * Decrypt an AES-256-GCM encrypted backup dump file.
 */
const decryptDumpFile = (sourcePath, destPath, secretKey) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Encrypted file does not exist: ${sourcePath}`);
  }
  if (!secretKey) {
    throw new Error('Decryption secretKey is required');
  }

  const fileBuffer = fs.readFileSync(sourcePath);
  if (fileBuffer.length < 32) {
    throw new Error('Encrypted file is too small or corrupted (missing IV or AuthTag)');
  }

  const iv = fileBuffer.subarray(0, 16);
  const authTag = fileBuffer.subarray(16, 32);
  const ciphertext = fileBuffer.subarray(32);

  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  fs.writeFileSync(destPath, decrypted);

  return {
    sourcePath,
    destPath,
    decryptedBytes: decrypted.length,
    valid: true,
  };
};

module.exports = {
  PGDUMP_MAGIC,
  applyRetentionPolicy,
  decryptDumpFile,
  encryptDumpFile,
  getBackupStatus,
  inspectDumpTOC,
  isSafeTestDatabase,
  validateDumpHeader,
};
