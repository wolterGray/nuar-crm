const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {processDueSmsDeliveries} = require('../services/smsService');

async function main() {
  const result = await processDueSmsDeliveries({
    limit: Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || 50,
  });

  console.log(JSON.stringify({
    processed: result.processed,
    timestamp: new Date().toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error('Notification worker failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode || 0);
  });
