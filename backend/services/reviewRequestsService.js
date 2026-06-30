// backend/services/reviewRequestsService.js
// Service for handling review request notifications (e.g., email to reviewer).

const nodemailer = require('nodemailer');

/**
 * Sends a review request email.
 * @param {Object} payload
 * @param {string} payload.reviewerEmail - Email of the reviewer.
 * @param {string} payload.subject - Email subject.
 * @param {string} payload.text - Plain text body.
 * @param {string} [payload.html] - Optional HTML body.
 * @returns {Promise<Object>} Result indicating success or error.
 */
const reviewRequests = async (payload) => {
  const { reviewerEmail, subject, text, html } = payload || {};
  if (!reviewerEmail || !subject || !text) {
    return { success: false, error: 'reviewerEmail, subject and text are required' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `no-reply@${process.env.VITE_SUPABASE_URL || 'localhost'}`,
      to: reviewerEmail,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
};

module.exports = { reviewRequests };
