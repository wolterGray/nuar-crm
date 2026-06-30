const express = require('express');
const router = express.Router();
const { sendBulkSms } = require('../services/smsService');
const { telegramDigest } = require('../services/telegramService');
const { smsReminders } = require('../services/remindersService');
const { ownerNotify } = require('../services/ownerNotifyService');
const { reviewRequests } = require('../services/reviewRequestsService');
const { booksySync } = require('../services/booksySyncService');

// Bulk SMS
router.post('/bulk-sms', async (req, res) => {
  const { action, recipients, message, testNumber } = req.body;

  try {
    if (action === 'test') {
      const result = await sendBulkSms({ recipients: [testNumber], message });
      return res.json({ success: true, message: 'Test SMS sent', result });
    }

    if (action === 'send') {
      const result = await sendBulkSms({ recipients, message });
      return res.json({ success: true, message: 'Bulk SMS process initiated', result });
    }

    if (action === 'status') {
      return res.json({ success: true, status: 'idle' });
    }

    res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('Bulk SMS error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Telegram Digest (stub)
router.post('/telegram-digest', async (req, res) => {
  const payload = req.body;
  const result = await telegramDigest(payload);
  res.json(result);
});

// SMS Reminders (stub)
router.post('/sms-reminders', async (req, res) => {
  const payload = req.body;
  const result = await smsReminders(payload);
  res.json(result);
});

// Owner Notify (stub)
router.post('/owner-notify', async (req, res) => {
  const payload = req.body;
  const result = await ownerNotify(payload);
  res.json(result);
});

// Review Requests (stub)
router.post('/review-requests', async (req, res) => {
  const payload = req.body;
  const result = await reviewRequests(payload);
  res.json(result);
});

// Booksy Sync (stub)
router.post('/booksy-sync', async (req, res) => {
  const payload = req.body;
  // TODO: implement actual Booksy synchronization logic
  const result = { success: true, message: 'Booksy sync placeholder (stub)' };
  res.json(result);
});

module.exports = router;
