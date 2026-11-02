#!/usr/bin/env node
require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const {redactSensitiveData} = require('../services/loggingService');

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

async function main() {
  let cursor = null;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const records = await prisma.errorEvent.findMany({
      ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
      orderBy: {id: 'asc'},
      select: {context: true, id: true},
      take: BATCH_SIZE,
    });
    if (!records.length) break;

    for (const record of records) {
      scanned += 1;
      const sanitized = redactSensitiveData(record.context);
      if (JSON.stringify(sanitized) !== JSON.stringify(record.context)) {
        await prisma.errorEvent.update({where: {id: record.id}, data: {context: sanitized}});
        updated += 1;
      }
    }
    cursor = records.at(-1).id;
  }

  console.log(`ErrorEvent cleanup complete: scanned=${scanned}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error('ErrorEvent cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
