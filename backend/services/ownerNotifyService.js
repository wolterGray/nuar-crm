// backend/services/ownerNotifyService.js
// Service for notifying the owner (e.g., via email).
// Uses nodemailer; SMTP credentials are read from environment variables.

const nodemailer = require('nodemailer');

/**
 * Sends an email notification to the owner.
 * @param {Object} payload
 * @param {string} payload.subject - Email subject.
 * @param {string} payload.text - Plain text body.
 * @param {string} [payload.html] - Optional HTML body.
 * @returns {Promise<Object>} Result indicating success or error.
 */
const ownerNotify = async (payload) => {
  const { subject, text, html } = payload || {};
  if (!subject || !text) {
    return { success: false, error: 'subject and text are required' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `no-reply@${process.env.VITE_SUPABASE_URL || 'localhost'}`,
      to: process.env.OWNER_EMAIL,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
};

module.exports = { ownerNotify };
