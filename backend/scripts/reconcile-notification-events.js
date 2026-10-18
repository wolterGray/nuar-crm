require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const {reconcileNotificationEventLifecycle} = require('../services/notificationEventsService');

const prisma = new PrismaClient();
const commit = process.argv.includes('--commit');

async function main() {
  const result = await reconcileNotificationEventLifecycle(prisma, {commit});
  console.log(JSON.stringify({
    byType: result.byType,
    candidateCount: result.count,
    mode: commit ? 'commit' : 'dry-run',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
