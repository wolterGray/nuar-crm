const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {PrismaClient} = require('@prisma/client');
const {generateSmartNotificationEvents} = require('../services/notificationEventsService');

const prisma = new PrismaClient();

async function main() {
  const result = await generateSmartNotificationEvents(prisma);
  console.log(JSON.stringify({
    generated: result.count,
    timestamp: new Date().toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error('Notification event generator failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });
