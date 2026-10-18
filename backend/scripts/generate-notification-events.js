const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {PrismaClient} = require('@prisma/client');
const {
  generateSmartNotificationEvents,
  reconcileNotificationEventLifecycle,
} = require('../services/notificationEventsService');

const prisma = new PrismaClient();

async function main() {
  const result = await generateSmartNotificationEvents(prisma);
  const lifecycleWriteEnabled = process.env.NOTIFICATION_LIFECYCLE_V2_WRITE === 'true';
  const lifecycle = await reconcileNotificationEventLifecycle(prisma, {
    commit: lifecycleWriteEnabled,
  });
  console.log(JSON.stringify({
    generated: result.count,
    lifecycle: {
      candidates: lifecycle.count,
      committed: lifecycleWriteEnabled,
    },
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
