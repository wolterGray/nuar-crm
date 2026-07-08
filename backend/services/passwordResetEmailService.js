const nodemailer = require('nodemailer');

const PASSWORD_RESET_TTL_MINUTES = Math.min(
  60,
  Math.max(30, Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES) || 45),
);

const getAuthEmailFrom = () =>
  process.env.AUTH_EMAIL_FROM ||
  process.env.EMAIL_FROM ||
  'NUAR CRM <no-reply@nuarr.pl>';

const isPasswordResetSmtpConfigured = () =>
  Boolean(
    String(process.env.EMAIL_HOST ?? '').trim() &&
      String(process.env.EMAIL_USER ?? '').trim() &&
      String(process.env.EMAIL_PASS ?? '').trim(),
  );

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

async function sendPasswordResetEmail({email, resetUrl}) {
  if (!isPasswordResetSmtpConfigured()) {
    return {sent: false, reason: 'smtp not configured'};
  }

  const info = await createTransporter().sendMail({
    from: getAuthEmailFrom(),
    to: email,
    subject: 'NUAR CRM password reset',
    text: [
      'A password reset was requested for your NUAR CRM account.',
      '',
      `Open this link to set a new password: ${resetUrl}`,
      '',
      `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      'If you did not request this, ignore this email.',
    ].join('\n'),
  });

  return {sent: true, messageId: info.messageId};
}

module.exports = {
  isPasswordResetSmtpConfigured,
  sendPasswordResetEmail,
};
