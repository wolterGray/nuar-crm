#!/usr/bin/env node

require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const {checkDataIntegrity} = require('../services/dataIntegrityService');

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await checkDataIntegrity(prisma);
    console.log(JSON.stringify(result, null, 2));
    if (!result.healthy) process.exitCode = 1;
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
