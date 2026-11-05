const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendDir = path.resolve(__dirname, '..');

const collectRuntimeFiles = (directory) => fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) {
    if (entry.name === 'node_modules' || entry.name === 'scripts' || entry.name === 'test') return [];
    return collectRuntimeFiles(entryPath);
  }
  return entry.name.endsWith('.js') ? [entryPath] : [];
});

test('backend runtime uses one shared Prisma connection pool', () => {
  const constructors = collectRuntimeFiles(backendDir)
    .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('new PrismaClient('))
    .map((filePath) => path.relative(backendDir, filePath));

  assert.deepEqual(constructors, ['services/prismaClient.js']);
});

