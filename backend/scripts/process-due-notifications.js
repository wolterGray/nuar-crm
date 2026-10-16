const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {processDueSmsDeliveries} = require('../services/smsService');
const {PrismaClient} = require('@prisma/client');
const {processDueWebPushDeliveries} = require('../services/businessPushService');

const prisma = new PrismaClient();

async function main() {
  const limit = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || 50;
  const [sms, webPush] = await Promise.all([processDueSmsDeliveries({
    limit,
  }), processDueWebPushDeliveries(prisma, {limit})]);

  console.log(JSON.stringify({
    sms,
    webPush,
    timestamp: new Date().toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error('Notification worker failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect().finally(() => process.exit(process.exitCode || 0));
  });
